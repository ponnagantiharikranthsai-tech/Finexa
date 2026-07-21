"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit-log";

export async function createFunderAction(prevState: any, formData: FormData) {
  try {
    await requireAuth();

    const name = formData.get("name") as string;
    const mobile = formData.get("mobile") as string;
    const address = formData.get("address") as string;
    const capitalAmountStr = formData.get("capitalAmount") as string;
    const investmentDate = formData.get("investmentDate") as string;
    const returnDueDate = formData.get("returnDueDate") as string;
    const notes = formData.get("notes") as string;

    if (!name || !mobile || !address || !capitalAmountStr || !investmentDate || !returnDueDate) {
      return { success: false, error: "All required fields must be filled out." };
    }

    const capitalAmount = Number(capitalAmountStr);
    if (isNaN(capitalAmount) || capitalAmount <= 0) {
      return { success: false, error: "Capital amount must be a positive number." };
    }

    // Check for duplicate mobile
    const existing = await capitalRepository.findFunderByMobile(mobile);
    if (existing) {
      return { success: false, error: "A funder with this mobile number already exists." };
    }

    const funder = await capitalRepository.createFunder({
      name,
      mobile,
      address,
      capitalAmount: capitalAmount.toFixed(2),
      investmentDate,
      returnDueDate,
      status: "active",
      notes: notes || null,
    });

    await auditLog("funder_created", "funder", funder.funderId, { name: funder.name, mobile: funder.mobile });

    revalidatePath("/capital-management");

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || "Failed to create funder profile." };
  }
}
