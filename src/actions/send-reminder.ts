'use server';

import { getOrCreateBorrowerTokenAction } from '@/actions/borrower-portal';
import { resend } from '@/services/email/resend';
import { sendFast2SMS } from '@/services/sms/providers/fast2sms.provider';

export async function sendReminderAction({
  loanId,
  borrowerName,
  borrowerEmail,
  borrowerPhone,
  loanAmount,
  totalPayable,
  amountDue,
  dueDate,
}: {
  loanId: string;
  borrowerName: string;
  borrowerEmail?: string;
  borrowerPhone?: string;
  loanAmount?: number;
  totalPayable?: number;
  amountDue?: number;
  dueDate: string;
}) {
  try {
    // 1. Resolve live passbook token
    const tokenResult = await getOrCreateBorrowerTokenAction(loanId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finexalending.app';
    const passbookUrl = tokenResult.success ? `${appUrl}/portal/${tokenResult.token}` : appUrl;

    const effectiveLoanAmount = loanAmount ?? amountDue ?? 0;
    const effectiveTotalPayable = totalPayable ?? amountDue ?? effectiveLoanAmount;

    // Standard text message requested
    const formattedTextMessage = 
`Hello ${borrowerName},

This is a reminder from Finexa regarding your loan payment.

Your payment is due on ${dueDate}.

Loan Amount: ₹${effectiveLoanAmount.toLocaleString('en-IN')}
Total Payable: ₹${effectiveTotalPayable.toLocaleString('en-IN')}
Due Date: ${dueDate}

View your digital passbook: ${passbookUrl}

Please arrange the payment before the due date.

Thank you,
Finexa
Smart Loan Management`;

    // 2. Send SMS via Fast2SMS
    if (borrowerPhone) {
      await sendFast2SMS({
        phone: borrowerPhone,
        message: formattedTextMessage,
      });
    }

    // 3. Send HTML Email via Resend
    if (borrowerEmail) {
      if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_REAL_DEV_EMAIL !== 'true' && !process.env.RESEND_API_KEY) {
        console.log(`[DEV EMAIL SANDBOX] Simulated Reminder Email to ${borrowerEmail} with link ${passbookUrl}`);
      } else {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Finexa <notifications@finexa.app>',
          to: borrowerEmail,
          subject: `Payment Reminder - Due ${dueDate} | Finexa`,
          html: `
            <div style="font-family: Arial, sans-serif; background-color: #0d0d11; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
              <p style="font-size: 16px; margin-bottom: 16px;">Hello <strong>${borrowerName}</strong>,</p>
              <p style="color: #cbd5e1; font-size: 14px;">This is a reminder from <strong>Finexa</strong> regarding your loan payment.</p>
              <p style="color: #f59e0b; font-weight: bold; font-size: 15px;">Your payment is due on ${dueDate}.</p>
              
              <div style="background-color: #141418; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                  <span style="color: #94a3b8;">Loan Amount:</span>
                  <strong>₹${effectiveLoanAmount.toLocaleString('en-IN')}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                  <span style="color: #94a3b8;">Total Payable:</span>
                  <strong style="color: #10b981;">₹${effectiveTotalPayable.toLocaleString('en-IN')}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px;">
                  <span style="color: #94a3b8;">Due Date:</span>
                  <strong>${dueDate}</strong>
                </div>
              </div>

              <div style="text-align: center; margin: 24px 0;">
                <a href="${passbookUrl}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  View Digital Passbook
                </a>
              </div>

              <p style="color: #cbd5e1; font-size: 14px;">Please arrange the payment before the due date.</p>
              
              <hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />
              <p style="font-size: 13px; color: #94a3b8; margin: 0;">Thank you,<br/><strong style="color: #f59e0b;">Finexa</strong><br/>Smart Loan Management</p>
            </div>
          `,
        });
      }
    }

    return { success: true, passbookUrl };
  } catch (error: any) {
    console.error('Failed to send formatted reminder:', error);
    return { success: false, error: error.message };
  }
}
