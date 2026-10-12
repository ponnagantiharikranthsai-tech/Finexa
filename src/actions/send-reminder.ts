'use server';

import { db } from '@/db';
import { getOrCreateBorrowerTokenAction } from '@/actions/borrower-portal';
import { resend } from '@/services/email/resend';
import { sendFast2SMS } from '@/services/sms/providers/fast2sms.provider';

export async function sendReminderAction({
  loanId,
  borrowerName,
  borrowerEmail,
  borrowerPhone,
  amountDue,
  dueDate,
}: {
  loanId: string;
  borrowerName: string;
  borrowerEmail?: string;
  borrowerPhone?: string;
  amountDue: number;
  dueDate: string;
}) {
  try {
    // 1. Get or create the unique magic passbook token for this loan
    const tokenResult = await getOrCreateBorrowerTokenAction(loanId);
    if (!tokenResult.success || !tokenResult.token) {
      throw new Error('Failed to generate passbook token');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finexalending.app';
    const passbookUrl = `${appUrl}/portal/${tokenResult.token}`;

    // 2. Dispatch Email with Passbook Link
    if (borrowerEmail) {
      if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_REAL_DEV_EMAIL !== 'true' && !process.env.RESEND_API_KEY) {
        console.log(`[DEV EMAIL SANDBOX] Simulated Reminder Email to ${borrowerEmail} with link ${passbookUrl}`);
      } else {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'FINEXA <notifications@finexa.app>',
          to: borrowerEmail,
          subject: `FINEXA Payment Reminder - Due ₹${amountDue.toLocaleString()}`,
          html: `
            <div style="font-family: sans-serif; background: #0d0d11; color: #f8fafc; padding: 24px; border-radius: 16px;">
              <h2 style="color: #f59e0b; margin-top: 0;">FINEXA Payment Reminder</h2>
              <p>Dear ${borrowerName},</p>
              <p>This is a polite reminder that your payment of <strong>₹${amountDue.toLocaleString()}</strong> is due on <strong>${dueDate}</strong>.</p>
              
              <div style="margin: 24px 0;">
                <a href="${passbookUrl}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  View Live Passbook & Balance
                </a>
              </div>

              <p style="color: #94a3b8; font-size: 12px;">Or copy this link: ${passbookUrl}</p>
            </div>
          `,
        });
      }
    }

    // 3. Dispatch SMS with Passbook Link (Fast2SMS)
    if (borrowerPhone) {
      const smsMessage = `Hello ${borrowerName}, your FINEXA payment of Rs.${amountDue} is due on ${dueDate}. View your live passbook: ${passbookUrl}`;
      await sendFast2SMS({
        phone: borrowerPhone,
        message: smsMessage,
      });
    }

    return { success: true, passbookUrl };
  } catch (error: any) {
    console.error('Failed to send reminder with passbook link:', error);
    return { success: false, error: error.message };
  }
}
