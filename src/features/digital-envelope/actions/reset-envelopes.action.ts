"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";

export interface ResetEnvelopesActionResult {
  success: boolean;
  error?: string;
}

export async function resetEnvelopesAction(): Promise<ResetEnvelopesActionResult> {
  try {
    await requireAuth();

    await withDbRetry(() => digitalEnvelopeRepository.resetAllEnvelopes());

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error in resetEnvelopesAction:", error);
    return {
      success: false,
      error: error?.message || "Failed to reset digital envelopes.",
    };
  }
}
