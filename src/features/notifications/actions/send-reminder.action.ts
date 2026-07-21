"use server";

import { loanRepository } from "@/features/loans/repository/loan.repository";
import { emailService } from "@/services/email/email.service";
import { smsService } from "@/services/sms/sms.service";
import { notificationLogRepository } from "../repository/notification-log.repository";
import { calculatePeriods, calculateMonthlyInterest } from "@/domain/interest-calculator";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function sendReminderAction(
  loanId: string,
  penaltyAmount?: number
): Promise<ActionResult<null>> {
  try {
    await requireAuth();

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.status === "closed") {
      return { success: false, error: "Cannot send reminders for a closed loan." };
    }



    let updatedPenaltyAmount = Number(loan.penaltyAmount || 0);
    if (penaltyAmount !== undefined && penaltyAmount >= 0) {
      await loanRepository.updatePenalty(loanId, penaltyAmount);
      updatedPenaltyAmount = penaltyAmount;
      loan.penaltyAmount = penaltyAmount.toString();
    }

    const periods = calculatePeriods(loan.dateGiven, loan.dueDate);
    const interestDue = periods * calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate));

    const totalInterestAndPenalty = interestDue + updatedPenaltyAmount;
    const finalOutstandingBalance = Number(loan.principal) + totalInterestAndPenalty; // Note: simplified for display before full payment summation

    if (loan.borrower.email) {
      try {
        await emailService.sendReminderEmail({
          loanId: loan.loanId,
          borrowerName: loan.borrower.name,
          borrowerEmail: loan.borrower.email,
          principal: Number(loan.principal),
          outstandingBalance: finalOutstandingBalance,
          interestDue,
          penaltyAmount: updatedPenaltyAmount,
          dueDate: loan.dueDate,
        });

        await notificationLogRepository.insert({
          loanId: loan.loanId,
          channel: "email",
          type: "reminder",
          status: "sent",
        });
      } catch (e: any) {
        console.error("Reminder email failed:", e);
        await notificationLogRepository.insert({
          loanId: loan.loanId,
          channel: "email",
          type: "reminder",
          status: "failed",
          errorMessage: e.message || "Failed to send email",
        });
        return { success: false, error: "Unable to send email. Please try again later." };
      }
    }

    try {
      const smsMessage = `Finexa Legal & Compliance: Clear pending account dues of Rs.${finalOutstandingBalance.toLocaleString("en-IN")} by ${loan.dueDate} to avoid legal recovery proceedings.`;
      const smsRes = await smsService.sendSMS(loan.borrower.mobile, smsMessage);

      await notificationLogRepository.insert({
        loanId: loan.loanId,
        channel: "sms",
        type: "reminder",
        status: smsRes.success ? "sent" : "failed",
        errorMessage: smsRes.error || null,
      });
    } catch (e: any) {
      await notificationLogRepository.insert({
        loanId: loan.loanId,
        channel: "sms",
        type: "reminder",
        status: "failed",
        errorMessage: e.message || "Failed to send SMS",
      });
    }

    await auditLog("reminder_sent", "loan", loanId, { penaltyAmount });

    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to send reminder" };
  }
}
