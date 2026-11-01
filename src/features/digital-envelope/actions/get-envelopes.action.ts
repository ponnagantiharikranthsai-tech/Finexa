"use server";

import { requireAuth } from "@/lib/auth";
import { withDbRetry } from "@/db/client";
import { digitalEnvelopeRepository } from "../repository/digital-envelope.repository";
import type { DigitalEnvelopeDashboardData } from "../types";

export interface GetEnvelopesActionResult {
  success: boolean;
  data?: DigitalEnvelopeDashboardData;
  error?: string;
}

export async function getEnvelopesAction(): Promise<GetEnvelopesActionResult> {
  try {
    await requireAuth();

    const data = await withDbRetry(() =>
      digitalEnvelopeRepository.getDashboardData()
    );

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error("Error in getEnvelopesAction:", error);
    return {
      success: false,
      error: error?.message || "Failed to load digital envelopes data.",
    };
  }
}

