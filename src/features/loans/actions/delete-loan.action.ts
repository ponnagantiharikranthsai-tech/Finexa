"use server";

import { loanRepository } from "../repository/loan.repository";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import { revalidatePath } from "next/cache";

export async function deleteLoanAction(
  loanId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await requireAuth();

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    await loanRepository.deleteById(loanId);

    await auditLog("loan_deleted", "loan", loanId, {
      principal: loan.principal,
      dueDate: loan.dueDate,
    });

    revalidatePath("/loans");
    revalidatePath("/borrowers");
    revalidatePath("/loan-management");

    return {
      success: true,
      data: { success: true },
    };
  } catch (err) {
    console.error("Delete loan error:", err);
    return {
      success: false,
      error: "Unable to delete loan. Please try again or contact the administrator."
    };
  }
}
