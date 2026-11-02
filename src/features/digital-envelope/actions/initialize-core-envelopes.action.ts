"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";
import type { DigitalEnvelopeItem } from "../types";

export interface InitializeCoreEnvelopesActionResult {
  success: boolean;
  data?: DigitalEnvelopeItem[];
  error?: string;
}

export async function initializeCoreEnvelopesAction(): Promise<InitializeCoreEnvelopesActionResult> {
  try {
    await requireAuth();

    const data = await withDbRetry(() => digitalEnvelopeRepository.initializeCoreEnvelopes());

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error("Error in initializeCoreEnvelopesAction:", error);
    return {
      success: false,
      error: error?.message || "Failed to initialize core envelopes.",
    };
  }
}
