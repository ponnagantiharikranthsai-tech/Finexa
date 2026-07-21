"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit-log";

export async function deleteFunderAction(funderId: string) {
  try {
    await requireAuth();

    if (!funderId) {
      return { success: false, error: "Funder ID is required." };
    }

    const deleted = await capitalRepository.deleteFunder(funderId);
    if (!deleted) {
      return { success: false, error: "Funder not found." };
    }

    await auditLog("funder_deleted", "funder", funderId, { name: deleted.name, mobile: deleted.mobile });

    revalidatePath("/capital-management");

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || "Failed to delete funder profile." };
  }
}
