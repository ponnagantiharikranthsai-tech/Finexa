"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";

export interface ReconcileBankBalanceInput {
  newBankBalance: number;
}

export interface ReconcileBankBalanceActionResult {
  success: boolean;
  data?: { newBankBalance: number };
  message?: string;
  error?: string;
}

export async function reconcileBankBalanceAction(
  input: ReconcileBankBalanceInput
): Promise<ReconcileBankBalanceActionResult> {
  try {
    await requireAuth();

    const balance = Number(input.newBankBalance);
    if (isNaN(balance) || balance < 0) {
      return { success: false, error: "Please enter a valid bank balance." };
    }

    const updated = await withDbRetry(() =>
      digitalEnvelopeRepository.setBankBalance(balance)
    );

    safeRevalidatePath("/digital-envelope");

    return {
      success: true,
      data: { newBankBalance: updated },
      message: `Account 2 bank balance updated to ₹${updated.toLocaleString("en-IN")}.`,
    };
  } catch (error: any) {
    console.error("Error in reconcileBankBalanceAction:", error);
    return {
      success: false,
      error: error?.message || "Failed to update bank balance.",
    };
  }
}

