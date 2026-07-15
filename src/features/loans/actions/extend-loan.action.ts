"use server";

import { loanRepository } from "../repository/loan.repository";
import { calculateDueDate } from "@/domain/due-date-calculator";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function extendLoanAction(
  loanId: string
): Promise<ActionResult<{ newDueDate: string }>> {
  try {
    await requireAuth();

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.status === "closed") {
      return { success: false, error: "Cannot extend a closed loan" };
    }

    if (loan.status !== "overdue" && loan.status !== "active" && loan.status !== "extended") {
      return { success: false, error: "Cannot extend this loan in its current status." };
    }

    // Check idempotency: if updated_at is today and status is already extended, restrict duplicate extensions on the same calendar day.
    const today = new Date().toISOString().split("T")[0]!;
    const updatedDate = new Date(loan.updatedAt).toISOString().split("T")[0]!;
    if (loan.status === "extended" && updatedDate === today) {
      return { success: false, error: "This loan has already been extended today." };
    }

    const currentDueDate = new Date(loan.dueDate);
    const newDueDateDate = calculateDueDate(currentDueDate);
    
    await loanRepository.updateDueDate(loanId, newDueDateDate);
    await loanRepository.updateStatus(loanId, "extended");

    await auditLog("loan_extended", "loan", loanId, {
      previousDueDate: loan.dueDate,
      newDueDate: newDueDateDate.toISOString().split("T")[0],
    });

    return {
      success: true,
      data: { newDueDate: newDueDateDate.toISOString().split("T")[0]! },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to extend loan" };
  }
}
