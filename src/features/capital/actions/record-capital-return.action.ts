"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { auditLog } from "@/lib/audit-log";

export interface RecordCapitalReturnInput {
  funderId: string;
  amount: number | string;
  returnDate: string;
  notes?: string;
}

export async function recordCapitalReturnAction(
  prevStateOrData: any,
  maybeFormData?: FormData
) {
  try {
    await requireAuth();

    let funderId = "";
    let amountStr = "";
    let returnDate = "";
    let notes: string | null = null;

    if (maybeFormData instanceof FormData) {
      funderId = (maybeFormData.get("funderId") as string) || "";
      amountStr = (maybeFormData.get("amount") as string) || "";
      returnDate = (maybeFormData.get("returnDate") as string) || "";
      notes = (maybeFormData.get("notes") as string) || null;
    } else if (prevStateOrData instanceof FormData) {
      funderId = (prevStateOrData.get("funderId") as string) || "";
      amountStr = (prevStateOrData.get("amount") as string) || "";
      returnDate = (prevStateOrData.get("returnDate") as string) || "";
      notes = (prevStateOrData.get("notes") as string) || null;
    } else if (typeof prevStateOrData === "object" && prevStateOrData !== null) {
      funderId = prevStateOrData.funderId || "";
      amountStr = String(prevStateOrData.amount || "");
      returnDate = prevStateOrData.returnDate || "";
      notes = prevStateOrData.notes || null;
    }

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

    await auditLog("capital_returned", "funder", funderId, { amount });

    safeRevalidatePath("/capital-management");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record capital return." };
  }
}
