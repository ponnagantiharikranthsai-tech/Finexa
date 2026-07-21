"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import { borrowersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit-log";

export async function saveInternalNotesAction(borrowerId: string, notes: string) {
  try {
    await requireAuth();

    if (!borrowerId) {
      return { success: false, error: "Borrower ID is required." };
    }

    if (notes && notes.length > 6000) {
      return { success: false, error: "Notes exceed the maximum character capacity." };
    }

    const [updated] = await db
      .update(borrowersTable)
      .set({
        internalNotes: notes || null,
        internalNotesUpdatedAt: new Date(),
      })
      .where(eq(borrowersTable.borrowerId, borrowerId))
      .returning();

    if (!updated) {
      return { success: false, error: "Borrower not found." };
    }

    await auditLog("borrower_notes_updated", "borrower", borrowerId, { length: notes.length });

    revalidatePath("/loan-management");

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || "Failed to save notes." };
  }
}
