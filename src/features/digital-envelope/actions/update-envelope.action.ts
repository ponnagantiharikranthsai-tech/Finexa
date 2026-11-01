"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import type { DigitalEnvelopeItem } from "../types";

export interface UpdateEnvelopeInput {
  envelopeId: string;
  name?: string;
  category?: string;
  targetAmount?: number | null;
  color?: string;
  icon?: string;
  notes?: string | null;
}

export interface UpdateEnvelopeActionResult {
  success: boolean;
  data?: DigitalEnvelopeItem;
  message?: string;
  error?: string;
}

export async function updateEnvelopeAction(
  input: UpdateEnvelopeInput
): Promise<UpdateEnvelopeActionResult> {
  try {
    await requireAuth();

    if (!input.envelopeId) {
      return { success: false, error: "Envelope ID is required." };
    }

    const updated = await withDbRetry(() =>
      digitalEnvelopeRepository.updateEnvelope(input)
    );

    safeRevalidatePath("/digital-envelope");

    return {
      success: true,
      data: updated,
      message: `Envelope "${updated.name}" updated successfully.`,
    };
  } catch (error: any) {
    console.error("Error in updateEnvelopeAction:", error);
    return {
      success: false,
      error: error?.message || "Failed to update envelope.",
    };
  }
}

