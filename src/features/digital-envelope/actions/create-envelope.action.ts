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
  targetAmount?: number;
  color?: string;
  icon?: string;
  notes?: string;
  fundSource?: "external" | "unallocated_cash";
}

export interface CreateEnvelopeActionResult {
  success: boolean;
  data?: DigitalEnvelopeItem;
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

    const envelope = await withDbRetry(() =>
      digitalEnvelopeRepository.createEnvelope({
        name: input.name.trim(),
        category: input.category?.trim(),
        type: input.type,
        initialAmount: input.initialAmount ? Number(input.initialAmount) : 0,
        targetAmount: input.targetAmount ? Number(input.targetAmount) : undefined,
        color: input.color,
        icon: input.icon,
        notes: input.notes?.trim(),
        fundSource: input.fundSource,
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
    return {
      success: false,
      error: error?.message || "Failed to create digital envelope.",
    };
  }
}

