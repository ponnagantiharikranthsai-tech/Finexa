"use server";

import { paymentRepository } from "@/features/payments/repository/payment.repository";
import { notificationLogRepository } from "@/features/notifications/repository/notification-log.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { Payment, NotificationLog } from "@/db/schema";

export type ExtraLoanDetails = {
  payments: Payment[];
  notifications: NotificationLog[];
};

export async function getExtraLoanDetailsAction(loanId: string): Promise<ActionResult<ExtraLoanDetails>> {
  try {
    await requireAuth();
    const [payments, notifications] = await Promise.all([
      paymentRepository.findByLoanId(loanId),
      notificationLogRepository.findByLoanId(loanId),
    ]);
    return { success: true, data: { payments, notifications } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch extra loan details" };
  }
}
