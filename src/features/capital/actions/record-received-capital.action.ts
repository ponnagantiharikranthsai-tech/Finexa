"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { auditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/types/api.types";

export interface RecordReceivedCapitalInput {
  funderId: string;
  amount: number;
  fundingDate?: string;
  notes?: string;
}

export async function recordReceivedCapitalAction(
  input: RecordReceivedCapitalInput
): Promise<ActionResult<{ transactionId: string; transactionCode: string }>> {
  try {
    await requireAuth();

    const { funderId, amount, notes } = input;
    const fundingDate =
      input.fundingDate || new Date().toISOString().split("T")[0]!;

    if (!funderId) {
      return { success: false, error: "Capital Person is required." };
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: "Please enter a valid received amount greater than zero." };
    }

    const funder = await capitalRepository.findFunderById(funderId);
    if (!funder) {
      return { success: false, error: "Capital Person not found." };
    }

    const transactionCode = await capitalRepository.getNextTransactionCode();
    const transaction = await capitalRepository.createFundingTransaction({
      transactionCode,
      funderId,
      amount: numAmount.toFixed(2),
      fundingDate,
      status: "received",
      notes: notes?.trim() || `Capital received in advance from ${funder.name}`,
    });

    await auditLog("capital_received", "funder", funderId, {
      transactionCode,
      funderName: funder.name,
      amount: numAmount,
      date: fundingDate,
    });

    safeRevalidatePath("/capital-management");

    return {
      success: true,
      data: {
        transactionId: transaction.transactionId,
        transactionCode: transaction.transactionCode,
      },
    };
  } catch (err: any) {
    console.error("recordReceivedCapitalAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to record received capital.",
    };
  }
}
