"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit-log";

export async function recordCapitalReturnAction(prevState: any, formData: FormData) {
  try {
    await requireAuth();

    const funderId = formData.get("funderId") as string;
    const amountStr = formData.get("amount") as string;
    const returnDate = formData.get("returnDate") as string;
    const notes = formData.get("notes") as string;

    if (!funderId || !amountStr || !returnDate) {
      return { success: false, error: "All required fields must be filled out." };
    }

    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: "Return amount must be a positive number." };
    }

    const funder = await capitalRepository.findFunderById(funderId);
    if (!funder) {
      return { success: false, error: "Funder not found." };
    }

    // Insert capital return
    await capitalRepository.createCapitalReturn({
      funderId,
      amount: amount.toFixed(2),
      returnDate,
      notes: notes || null,
    });

    // Check if the total returned amount is equal to or greater than capitalAmount
    const returns = await capitalRepository.findCapitalReturnsByFunderId(funderId);
    const totalReturned = returns.reduce((sum, r) => sum + Number(r.amount), 0);

    if (totalReturned >= Number(funder.capitalAmount)) {
      await capitalRepository.updateFunder(funderId, { status: "returned" });
    } else {
      await capitalRepository.updateFunder(funderId, { status: "active" });
    }

    await auditLog("capital_returned", "funder", funderId, { amount, totalReturned });

    revalidatePath("/capital-management");

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || "Failed to record capital return." };
  }
}
