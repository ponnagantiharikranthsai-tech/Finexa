"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { auditLog } from "@/lib/audit-log";

export async function updateFunderAction(prevState: any, formData: FormData) {
  try {
    await requireAuth();

    const funderId = (formData.get("funderId") as string)?.trim();
    const name = (formData.get("name") as string)?.trim();
    const mobile = (formData.get("mobile") as string)?.trim();
    const address = (formData.get("address") as string)?.trim() || "";
    const notes = (formData.get("notes") as string)?.trim() || null;
    const status = (formData.get("status") as string)?.trim() as any;

    if (!funderId || !name || !mobile) {
      return { success: false, error: "Funder ID, Name, and Mobile are required." };
    }

    const updated = await capitalRepository.updateFunder(funderId, {
      name,
      mobile,
      address,
      notes,
      ...(status ? { status } : {}),
    });

    if (!updated) {
      return { success: false, error: "Capital person record not found." };
    }

    await auditLog("funder_updated", "funder", funderId, { name: updated.name });

    safeRevalidatePath("/capital-management");

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || "Failed to update capital person profile." };
  }
}
