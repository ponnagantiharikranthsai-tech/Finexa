"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import type { DigitalEnvelopeItem, DigitalEnvelopeTransactionItem } from "../types";

export interface PayBillWithdrawInput {
  envelopeId: string;
  amount: number;
  description: string;
  referenceParty?: string;
  isBillPayment?: boolean;
}

export interface PayBillWithdrawActionResult {
  success: boolean;
  data?: {
    updatedEnvelope: DigitalEnvelopeItem;
    transaction: DigitalEnvelopeTransactionItem;
  };
  message?: string;
  error?: string;
}

export async function payBillWithdrawAction(
  input: PayBillWithdrawInput
): Promise<PayBillWithdrawActionResult> {
  try {
    await requireAuth();

    if (!input.envelopeId) {
      return { success: false, error: "Envelope ID is required." };
    }

    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: "Please enter a valid amount greater than zero." };
    }

    if (!input.description || !input.description.trim()) {
      return {
        success: false,
        error: "Please enter a reason/description (e.g. Bill name, payee, or withdrawal purpose).",
      };
    }

    const res = await withDbRetry(() =>
      digitalEnvelopeRepository.payBillOrWithdraw({
        envelopeId: input.envelopeId,
        amount,
        description: input.description.trim(),
        referenceParty: input.referenceParty?.trim(),
        isBillPayment: input.isBillPayment ?? true,
      })
    );

    safeRevalidatePath("/digital-envelope");

    const actionLabel = input.isBillPayment ? "Bill payment of" : "Withdrawal of";
    return {
      success: true,
      data: res,
      message: `${actionLabel} ₹${amount.toLocaleString("en-IN")} recorded from ${res.updatedEnvelope.name}.`,
    };
  } catch (error: any) {
    console.error("Error in payBillWithdrawAction:", error);
    return {
      success: false,
      error: error?.message || "Failed to process withdrawal / bill payment.",
    };
  }
}

