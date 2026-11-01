"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import type { DigitalEnvelopeItem, DigitalEnvelopeTransactionItem } from "../types";

export interface AddEnvelopeMoneyInput {
  envelopeId: string;
  amount: number;
  description?: string;
  fundSource?: "external" | "unallocated_cash";
}

export interface AddEnvelopeMoneyActionResult {
  success: boolean;
  data?: {
    updatedEnvelope: DigitalEnvelopeItem;
    transaction: DigitalEnvelopeTransactionItem;
  };
  message?: string;
  error?: string;
}

export async function addEnvelopeMoneyAction(
  input: AddEnvelopeMoneyInput
): Promise<AddEnvelopeMoneyActionResult> {
  try {
    await requireAuth();

    if (!input.envelopeId) {
      return { success: false, error: "Envelope ID is required." };
    }

    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: "Please enter a valid amount greater than zero." };
    }

    const res = await withDbRetry(() =>
      digitalEnvelopeRepository.addMoney({
        envelopeId: input.envelopeId,
        amount,
        description: input.description,
        fundSource: input.fundSource,
      })
    );

    safeRevalidatePath("/digital-envelope");

    return {
      success: true,
      data: res,
      message: `Added ₹${amount.toLocaleString("en-IN")} to ${res.updatedEnvelope.name}.`,
    };
  } catch (error: any) {
    console.error("Error in addEnvelopeMoneyAction:", error);
    return {
      success: false,
      error: error?.message || "Failed to add money to envelope.",
    };
  }
}

