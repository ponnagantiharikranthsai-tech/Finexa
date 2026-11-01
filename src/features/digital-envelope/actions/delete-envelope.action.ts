"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";

export interface DeleteEnvelopeInput {
  envelopeId: string;
}

export interface DeleteEnvelopeActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function deleteEnvelopeAction(
  input: DeleteEnvelopeInput
): Promise<DeleteEnvelopeActionResult> {
  try {
    await requireAuth();

    if (!input.envelopeId) {
      return { success: false, error: "Envelope ID is required." };
    }

    await withDbRetry(() =>
      digitalEnvelopeRepository.deleteEnvelope(input.envelopeId)
    );

    safeRevalidatePath("/digital-envelope");

    return {
      success: true,
      message: "Envelope removed successfully.",
    };
  } catch (error: any) {
    console.error("Error in deleteEnvelopeAction:", error);
    return {
      success: false,
      error: error?.message || "Failed to delete envelope.",
    };
  }
}

