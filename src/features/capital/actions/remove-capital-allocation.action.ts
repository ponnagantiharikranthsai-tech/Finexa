"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import { capitalAllocationsTable, fundersTable, loansTable, borrowersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";
import { invalidateLoanManagementCache } from "@/features/loans/actions/get-loan-management-data.action";
import type { ActionResult } from "@/types/api.types";

export async function removeCapitalAllocationAction(
  allocationId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await requireAuth();

    if (!allocationId) {
      return { success: false, error: "Allocation ID is required." };
    }

    const [existing] = await db
      .select({
        allocation: capitalAllocationsTable,
        funder: fundersTable,
        loan: loansTable,
      })
      .from(capitalAllocationsTable)
      .innerJoin(fundersTable, eq(capitalAllocationsTable.funderId, fundersTable.funderId))
      .innerJoin(loansTable, eq(capitalAllocationsTable.loanId, loansTable.loanId))
      .where(eq(capitalAllocationsTable.allocationId, allocationId))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Capital allocation record not found." };
    }

    // Delete or release allocation record
    await db
      .delete(capitalAllocationsTable)
      .where(eq(capitalAllocationsTable.allocationId, allocationId));

    await auditLog("capital_allocation_removed", "loan", existing.loan.loanId, {
      allocationId,
      funderId: existing.funder.funderId,
      funderName: existing.funder.name,
      amount: existing.allocation.amount,
      loanId: existing.loan.loanId,
    });

    await invalidateLoanManagementCache().catch(() => {});

    return { success: true, data: { success: true } };
  } catch (err: any) {
    console.error("removeCapitalAllocationAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to remove capital allocation.",
    };
  }
}
