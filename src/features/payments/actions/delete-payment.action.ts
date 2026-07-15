"use server";

import { paymentRepository } from "../repository/payment.repository";
import { loanRepository } from "@/features/loans/repository/loan.repository";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function deletePaymentAction(
  paymentId: string,
  loanId: string
): Promise<ActionResult<null>> {
  try {
    await requireAuth();

    await paymentRepository.deleteById(paymentId);

    const outstanding = await paymentRepository.getOutstandingBalance(loanId);
    
    const loan = await loanRepository.findById(loanId);
    if (loan && loan.status === "closed" && outstanding > 0) {
      const todayStr = new Date().toISOString().split("T")[0]!;
      if (loan.dueDate < todayStr) {
        await loanRepository.updateStatus(loanId, "overdue");
      } else {
        await loanRepository.updateStatus(loanId, "active");
      }
      await auditLog("loan_reopened", "loan", loanId, { outstandingBalance: outstanding });
    }

    await auditLog("payment_deleted", "payment", undefined, { loanId, paymentId });

    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete payment" };
  }
}
