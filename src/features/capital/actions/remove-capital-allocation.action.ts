"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
  fundersTable,
  loansTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";
import { invalidateLoanManagementCache } from "@/features/loans/actions/get-loan-management-data.action";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/api.types";

export async function removeCapitalAllocationAction(
  allocationId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await requireAuth();

    if (!allocationId) {
      return { success: false, error: "Allocation ID is required." };
    }

    await db.transaction(async (tx) => {
      const [existing] = await tx
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
        throw new Error("Capital allocation record not found.");
      }

      // 1. Delete allocation record
      await tx
        .delete(capitalAllocationsTable)
        .where(eq(capitalAllocationsTable.allocationId, allocationId));

      // 2. Return linked capital funding transaction to unallocated
      if (existing.allocation.fundingTransactionId) {
        await tx
          .update(capitalFundingTransactionsTable)
          .set({
            loanId: null,
            status: "received",
            updatedAt: new Date(),
            notes: `[Unallocated - Allocation Removed from Loan ${existing.loan.loanId}] ${existing.allocation.notes || ""}`.trim(),
          })
          .where(
            eq(
              capitalFundingTransactionsTable.transactionId,
              existing.allocation.fundingTransactionId
            )
          );
      } else {
        // Fallback: match by funderId, loanId, and amount
        const [matchedTx] = await tx
          .select({ transactionId: capitalFundingTransactionsTable.transactionId })
          .from(capitalFundingTransactionsTable)
          .where(
            and(
              eq(capitalFundingTransactionsTable.funderId, existing.funder.funderId),
              eq(capitalFundingTransactionsTable.loanId, existing.loan.loanId),
              eq(capitalFundingTransactionsTable.amount, existing.allocation.amount)
            )
          )
          .limit(1);

        if (matchedTx) {
          await tx
            .update(capitalFundingTransactionsTable)
            .set({
              loanId: null,
              status: "received",
              updatedAt: new Date(),
              notes: `[Unallocated - Allocation Removed from Loan ${existing.loan.loanId}]`,
            })
            .where(
              eq(capitalFundingTransactionsTable.transactionId, matchedTx.transactionId)
            );
        }
      }

      await auditLog("capital_allocation_removed", "loan", existing.loan.loanId, {
        allocationId,
        funderId: existing.funder.funderId,
        funderName: existing.funder.name,
        amount: existing.allocation.amount,
        loanId: existing.loan.loanId,
      });
    });

    await invalidateLoanManagementCache().catch(() => {});
    revalidatePath("/loan-management");
    revalidatePath("/capital-management");

    return { success: true, data: { success: true } };
  } catch (err: any) {
    console.error("removeCapitalAllocationAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to remove capital allocation.",
    };
  }
}
