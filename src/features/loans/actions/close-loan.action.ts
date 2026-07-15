"use server";

import { loanRepository } from "../repository/loan.repository";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function closeLoanAction(loanId: string): Promise<ActionResult<null>> {
  try {
    await requireAuth();

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    await loanRepository.close(loanId);
    await auditLog("loan_closed", "loan", loanId);

    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to close loan" };
  }
}
