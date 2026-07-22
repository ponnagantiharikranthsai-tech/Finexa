"use server";

import { loanRepository } from "../repository/loan.repository";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function updatePenaltySettingsAction(
  loanId: string,
  penaltyType: "fixed" | "percentage",
  penaltyRate: number
): Promise<ActionResult<null>> {
  try {
    await requireAuth();

    if (penaltyRate < 0) {
      return { success: false, error: "Penalty rate cannot be negative." };
    }

    await loanRepository.updatePenaltySettings(loanId, penaltyType, penaltyRate, "Administrator");

    await auditLog("penalty_settings_updated", "loan", loanId, {
      penaltyType,
      penaltyRate,
    });

    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update penalty settings" };
  }
}
