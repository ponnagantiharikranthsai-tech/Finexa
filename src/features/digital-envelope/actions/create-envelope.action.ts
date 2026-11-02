"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import type { EnvelopeType, DigitalEnvelopeItem } from "../types";

export interface CreateEnvelopeInput {
  name: string;
  category?: string;
  type: EnvelopeType;
  initialAmount?: number;
  targetAmount?: number | null;
  color?: string;
  icon?: string;
  notes?: string | null;
  fundSource?: "external" | "unallocated_cash";
  allowDuplicate?: boolean;
}

export interface CreateEnvelopeActionResult {
  success: boolean;
  data?: DigitalEnvelopeItem;
  alreadyExists?: boolean;
  existingEnvelope?: {
    envelopeId: string;
    name: string;
    balance: number;
    type: string;
  };
  message?: string;
  error?: string;
}

export async function createEnvelopeAction(
  input: CreateEnvelopeInput
): Promise<CreateEnvelopeActionResult> {
  try {
    await requireAuth();

    if (!input.name || !input.name.trim()) {
      return { success: false, error: "Envelope name is required." };
    }

    if (input.type !== "personal" && input.type !== "third_party") {
      return { success: false, error: "Invalid envelope type." };
    }

    // Sanitize targetAmount: null if falsy, 0, or NaN
    const targetAmtNum = input.targetAmount !== undefined && input.targetAmount !== null ? Number(input.targetAmount) : NaN;
    const sanitizedTargetAmount = (!isNaN(targetAmtNum) && targetAmtNum > 0) ? targetAmtNum : null;

    const envelope = await withDbRetry(() =>
      digitalEnvelopeRepository.createEnvelope({
        name: input.name.trim(),
        category: input.category?.trim(),
        type: input.type,
        initialAmount: input.initialAmount ? Number(input.initialAmount) : 0,
        targetAmount: sanitizedTargetAmount,
        color: input.color?.trim(),
        icon: input.icon?.trim(),
        notes: input.notes?.trim() || null,
        fundSource: input.fundSource,
        allowDuplicate: input.allowDuplicate,
      })
    );

    safeRevalidatePath("/digital-envelope");

    return {
      success: true,
      data: envelope,
      message: `Envelope "${envelope.name}" created successfully.`,
    };
  } catch (error: any) {
    console.error("Error in createEnvelopeAction:", error);

    if (error?.alreadyExists && error.existingEnvelope) {
      return {
        success: false,
        alreadyExists: true,
        existingEnvelope: error.existingEnvelope,
        error: error.message || `Envelope "${error.existingEnvelope.name}" already exists.`,
      };
    }

    return {
      success: false,
      error: error?.message || "Failed to create digital envelope.",
    };
  }
}
