"use server";

import { paymentRepository } from "@/features/payments/repository/payment.repository";
import { notificationLogRepository } from "@/features/notifications/repository/notification-log.repository";
import { loanCycleRepository } from "../repository/loan-cycle.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { Payment, NotificationLog } from "@/db/schema";
import type { LoanCycle } from "@/db/schema/loan-cycles";

export type ExtraLoanDetails = {
  payments: Payment[];
  notifications: NotificationLog[];
  cycles: LoanCycle[];
};

export async function getExtraLoanDetailsAction(loanId: string): Promise<ActionResult<ExtraLoanDetails>> {
  try {
    await requireAuth();
    const [payments, notifications, cycles] = await Promise.all([
      paymentRepository.findByLoanId(loanId),
      notificationLogRepository.findByLoanId(loanId),
      loanCycleRepository.findByLoanId(loanId),
    ]);
    return { success: true, data: { payments, notifications, cycles } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch extra loan details" };
  }
}
