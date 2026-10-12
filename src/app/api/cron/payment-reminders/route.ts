import { NextResponse } from 'next/server';
import { db } from '@/db';
import { getOrCreateBorrowerTokenAction } from '@/actions/borrower-portal';
import { paymentReminderRepository } from '@/features/notifications/repository/payment-reminder.repository';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const authHeader = req.headers.get('authorization');
    const headerSecret = req.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET || 'finexa_local_cron_secret_key_2026';

    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isHeaderSecret = headerSecret === cronSecret;
    const isQuerySecret = secret === cronSecret;
    const isAuthorized = isVercelCron || isHeaderSecret || isQuerySecret;

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finexalending.app';

    // Fetch active loans due soon
    const activeLoans = await db.query.loans.findMany({
      where: (loans, { eq }) => eq(loans.status, 'active'),
      with: { borrower: true },
    });

    const generatedLinks: Array<{ loanId: string; borrowerName?: string; passbookUrl: string }> = [];

    for (const loan of activeLoans) {
      // Generate token for each loan in the cron loop
      const tokenResult = await getOrCreateBorrowerTokenAction(loan.loanId);
      if (tokenResult.success && tokenResult.token) {
        const passbookUrl = `${appUrl}/portal/${tokenResult.token}`;

        // Attach passbookUrl to automated Resend Email / Fast2SMS dispatchers
        console.log(`Sending automated cron alert for Loan ${loan.loanId} with link: ${passbookUrl}`);
        generatedLinks.push({
          loanId: loan.loanId,
          borrowerName: (loan as any).borrower?.name,
          passbookUrl,
        });
      }
    }

    // Process scheduled Web Push notifications
    const pushResult = await paymentReminderRepository.processScheduledWebPushNotifications();

    return NextResponse.json({
      success: true,
      processed: activeLoans.length,
      generatedTokens: generatedLinks.length,
      timestamp: new Date().toISOString(),
      webPushCount: pushResult?.pushedCount ?? 0,
    });
  } catch (err: any) {
    console.error('Cron job payment reminder error:', err);
    return NextResponse.json({ error: err.message || 'Failed cron execution' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
