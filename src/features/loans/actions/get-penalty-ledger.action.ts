"use server";

import { loanRepository } from "../repository/loan.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { PenaltyLedger } from "@/db/schema";

export async function getPenaltyLedgerAction(
  loanId: string
): Promise<ActionResult<PenaltyLedger[]>> {
  try {
    await requireAuth();
    const ledger = await loanRepository.getPenaltyLedger(loanId);
    return { success: true, data: ledger };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch penalty ledger" };
  }
}
