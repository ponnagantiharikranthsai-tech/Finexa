"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import { loansTable, borrowersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit-log";
import { invalidateLoanManagementCache } from "@/features/loans/actions/get-loan-management-data.action";
import { ensureLoanNotesColumnAndMigrate } from "@/features/loans/repository/loan.repository";

export async function saveInternalNotesAction(targetId: string, notes: string) {
  try {
    await requireAuth();

    if (!targetId) {
      return { success: false, error: "Record ID is required." };
    }

    if (notes && notes.length > 6000) {
      return { success: false, error: "Notes exceed the maximum character capacity." };
    }

    await ensureLoanNotesColumnAndMigrate();

    const cleanNotes = notes?.trim() ? notes : null;
    const now = new Date();

    // 1. First attempt: Update loan internalNotes by unique loanId
    const [updatedLoan] = await db
      .update(loansTable)
      .set({
        internalNotes: cleanNotes,
        internalNotesUpdatedAt: now,
      })
      .where(eq(loansTable.loanId, targetId))
      .returning();

    if (updatedLoan) {
      await auditLog("loan_notes_updated", "loan", targetId, { length: notes?.length || 0 });
      await invalidateLoanManagementCache();
      revalidatePath("/loan-management");
      revalidatePath(`/loans/${targetId}`);
      return { success: true };
    }

    // 2. Second attempt: Fallback to update borrower internalNotes by borrowerId
    const [updatedBorrower] = await db
      .update(borrowersTable)
      .set({
        internalNotes: cleanNotes,
        internalNotesUpdatedAt: now,
      })
      .where(eq(borrowersTable.borrowerId, targetId))
      .returning();

    if (updatedBorrower) {
      await auditLog("borrower_notes_updated", "borrower", targetId, { length: notes?.length || 0 });
      await invalidateLoanManagementCache();
      revalidatePath("/loan-management");
      return { success: true };
    }

    return { success: false, error: "Loan or Borrower record not found." };
  } catch (err) {
    return { success: false, error: (err as Error).message || "Failed to save notes." };
  }
}
