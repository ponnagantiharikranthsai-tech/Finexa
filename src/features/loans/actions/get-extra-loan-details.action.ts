"use server";

import { paymentRepository } from "@/features/payments/repository/payment.repository";
import { notificationLogRepository } from "@/features/notifications/repository/notification-log.repository";
import { loanCycleRepository } from "../repository/loan-cycle.repository";
import { loanRepository } from "../repository/loan.repository";
import { decrypt } from "@/lib/encryption";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { Payment, NotificationLog } from "@/db/schema";
import type { LoanCycle } from "@/db/schema/loan-cycles";

export type ExtraLoanDetails = {
  payments: Payment[];
  notifications: NotificationLog[];
  cycles: LoanCycle[];
  panDecrypted?: string;
  aadhaarDecrypted?: string;
};

export async function getExtraLoanDetailsAction(loanId: string): Promise<ActionResult<ExtraLoanDetails>> {
  try {
    await requireAuth();
    const [payments, notifications, cycles, loan] = await Promise.all([
      paymentRepository.findByLoanId(loanId),
      notificationLogRepository.findByLoanId(loanId),
      loanCycleRepository.findByLoanId(loanId),
      loanRepository.findById(loanId),
    ]);

    let panDecrypted = "";
    let aadhaarDecrypted = "";
    if (loan?.borrower) {
      try {
        panDecrypted = decrypt(loan.borrower.panEncrypted);
        aadhaarDecrypted = decrypt(loan.borrower.aadhaarEncrypted);
      } catch (e) {
        panDecrypted = "DECRYPTION_ERROR";
        aadhaarDecrypted = "DECRYPTION_ERROR";
      }
    }

    return {
      success: true,
      data: {
        payments,
        notifications,
        cycles,
        panDecrypted,
        aadhaarDecrypted,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch extra loan details" };
  }
}
