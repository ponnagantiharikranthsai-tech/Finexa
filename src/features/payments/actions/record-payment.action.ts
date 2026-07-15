"use server";

import { recordPaymentSchema } from "../schemas/record-payment.schema";
import { paymentRepository } from "../repository/payment.repository";
import { loanRepository } from "@/features/loans/repository/loan.repository";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function recordPaymentAction(
  _prevState: ActionResult<{ outstandingBalance: number }> | null,
  formData: FormData
): Promise<ActionResult<{ outstandingBalance: number }>> {
  try {
    await requireAuth();

    const raw = Object.fromEntries(formData);
    const parsed = recordPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      parsed.error.issues.forEach((err) => {
        const path = err.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(err.message);
      });
      return { success: false, error: fieldErrors };
    }

    const { loanId, amount, paymentType, paymentDate, notes } = parsed.data;

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.status === "closed") {
      return { success: false, error: "Cannot record payments against a closed loan" };
    }

    await paymentRepository.create({
      loanId,
      amount: amount.toString(),
      paymentType,
      paymentDate,
      notes: notes || null,
    });

    const outstanding = await paymentRepository.getOutstandingBalance(loanId);

    if (outstanding <= 0) {
      await loanRepository.close(loanId);
      await auditLog("loan_closed", "loan", loanId, { triggeredBy: "payment" });
    }

    await auditLog("payment_recorded", "payment", undefined, {
      loanId,
      amount,
      paymentType,
      outstandingBalance: outstanding,
    });

    return { success: true, data: { outstandingBalance: outstanding } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record payment" };
  }
}
