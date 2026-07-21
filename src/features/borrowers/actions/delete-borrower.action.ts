"use server";

import { borrowerRepository } from "../repository/borrower.repository";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import { revalidatePath } from "next/cache";

export async function deleteBorrowerAction(
  borrowerId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await requireAuth();

    const existing = await borrowerRepository.findById(borrowerId);
    if (!existing) {
      return { success: false, error: "Borrower not found." };
    }

    await borrowerRepository.deleteById(borrowerId);

    await auditLog("borrower_deleted", "borrower", borrowerId, { name: existing.name, mobile: existing.mobile });

    revalidatePath("/borrowers");
    revalidatePath("/loan-management");

    return { success: true, data: { success: true } };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete borrower";
    return { success: false, error: errorMsg };
  }
}
