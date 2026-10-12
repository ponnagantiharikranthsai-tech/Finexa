"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
  fundersTable,
  loansTable,
  borrowersTable,
} from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";
import { invalidateLoanManagementCache } from "@/features/loans/actions/get-loan-management-data.action";
import { capitalRepository } from "../repository/capital.repository";
import { getFunderLedgerAction } from "./get-funder-ledger.action";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/api.types";

export interface ReassignCapitalSourceInput {
  allocationId: string;
  newFunderId: string;
  amount: number;
  loanId: string;
  allocationDate?: string;
  notes?: string;
}

export async function reassignCapitalSourceAction(
  input: ReassignCapitalSourceInput
): Promise<ActionResult<{ newAllocationId: string; transactionCode: string }>> {
  try {
    await requireAuth();

    const { allocationId, newFunderId, amount, loanId, notes } = input;
    const allocationDate =
      input.allocationDate || new Date().toISOString().split("T")[0]!;

    if (!allocationId || !newFunderId || !loanId) {
      return { success: false, error: "All required fields must be provided." };
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: "Invalid amount for reassignment." };
    }

    let finalAllocationId = "";
    let finalTxCode = "";

    await db.transaction(async (tx) => {
      // 1. Fetch existing allocation
      const [existing] = await tx
        .select({
          allocation: capitalAllocationsTable,
          oldFunderId: capitalAllocationsTable.funderId,
          oldFundingTxId: capitalAllocationsTable.fundingTransactionId,
        })
        .from(capitalAllocationsTable)
        .where(eq(capitalAllocationsTable.allocationId, allocationId))
        .limit(1);

      if (!existing) {
        throw new Error("Allocation record not found.");
      }

      // 2. Fetch new funder
      const [newFunder] = await tx
        .select()
        .from(fundersTable)
        .where(eq(fundersTable.funderId, newFunderId))
        .limit(1);

      if (!newFunder) {
        throw new Error("New capital person not found.");
      }

      // 3. Fetch borrower name for notes
      const [loan] = await tx
        .select({ borrowerId: loansTable.borrowerId, principal: loansTable.principal })
        .from(loansTable)
        .where(eq(loansTable.loanId, loanId))
        .limit(1);

      const [borrower] = loan
        ? await tx
            .select({ name: borrowersTable.name })
            .from(borrowersTable)
            .where(eq(borrowersTable.borrowerId, loan.borrowerId))
            .limit(1)
        : [null];

      // 4. Remove old allocation record
      await tx
        .delete(capitalAllocationsTable)
        .where(eq(capitalAllocationsTable.allocationId, allocationId));

      // 5. Free old funding tx back to received/unallocated state
      if (existing.oldFundingTxId) {
        await tx
          .update(capitalFundingTransactionsTable)
          .set({
            loanId: null,
            status: "received",
            updatedAt: new Date(),
            notes: `[Unallocated - Freed by capital source reassignment on loan ${loanId}]`,
          })
          .where(
            eq(capitalFundingTransactionsTable.transactionId, existing.oldFundingTxId)
          );
      } else {
        // Fallback: match by funderId, loanId, and amount
        const [matchedTx] = await tx
          .select({ transactionId: capitalFundingTransactionsTable.transactionId })
          .from(capitalFundingTransactionsTable)
          .where(
            and(
              eq(capitalFundingTransactionsTable.funderId, existing.oldFunderId),
              eq(capitalFundingTransactionsTable.loanId, loanId),
              eq(capitalFundingTransactionsTable.status, "allocated")
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
              notes: `[Unallocated - Freed by capital source reassignment on loan ${loanId}]`,
            })
            .where(
              eq(capitalFundingTransactionsTable.transactionId, matchedTx.transactionId)
            );
        }
      }

      // 6. Consume new funder's unallocated capital first
      const ledgerRes = await getFunderLedgerAction(newFunderId);
      let availableUnallocated =
        ledgerRes.success && ledgerRes.data
          ? ledgerRes.data.metrics.unallocatedReceived
          : 0;

      const unallocatedTxs = await tx
        .select()
        .from(capitalFundingTransactionsTable)
        .where(
          and(
            eq(capitalFundingTransactionsTable.funderId, newFunderId),
            sql`(${capitalFundingTransactionsTable.loanId} IS NULL OR ${capitalFundingTransactionsTable.status} IN ('received', 'unallocated'))`,
            sql`${capitalFundingTransactionsTable.status} != 'released'`
          )
        )
        .orderBy(asc(capitalFundingTransactionsTable.createdAt));

      let remainingNeeded = numAmount;

      for (const unallocTx of unallocatedTxs) {
        if (remainingNeeded <= 0 || availableUnallocated <= 0) break;
        const txAmt = Number(unallocTx.amount) || 0;
        if (txAmt <= 0) continue;

        const usableAmt = Math.min(txAmt, availableUnallocated);
        if (usableAmt <= 0) continue;

        if (usableAmt <= remainingNeeded + 0.001) {
          availableUnallocated -= usableAmt;

          const [updated] = await tx
            .update(capitalFundingTransactionsTable)
            .set({
              loanId,
              status: "allocated",
              fundingDate: allocationDate,
              updatedAt: new Date(),
              notes: `Reassigned to ${borrower?.name || "borrower"} (Loan: ${loanId}). Prev: ${unallocTx.notes || ""}`,
            })
            .where(eq(capitalFundingTransactionsTable.transactionId, unallocTx.transactionId))
            .returning();

          const [alloc] = await tx
            .insert(capitalAllocationsTable)
            .values({
              funderId: newFunderId,
              loanId,
              fundingTransactionId: unallocTx.transactionId,
              amount: txAmt.toFixed(2),
              allocationDate,
              status: "active",
              notes: notes?.trim() || null,
            })
            .returning();

          if (!finalAllocationId) finalAllocationId = alloc.allocationId;
          if (!finalTxCode) finalTxCode = updated.transactionCode;
          remainingNeeded -= txAmt;
        } else {
          const allocatedPortion = remainingNeeded;
          const unallocatedPortion = txAmt - remainingNeeded;

          const [updatedAllocated] = await tx
            .update(capitalFundingTransactionsTable)
            .set({
              amount: allocatedPortion.toFixed(2),
              loanId,
              status: "allocated",
              fundingDate: allocationDate,
              updatedAt: new Date(),
              notes: `Partial reassignment to ${borrower?.name || "borrower"} (Loan: ${loanId})`,
            })
            .where(eq(capitalFundingTransactionsTable.transactionId, unallocTx.transactionId))
            .returning();

          const nextCode = await capitalRepository.getNextTransactionCode();
          await tx.insert(capitalFundingTransactionsTable).values({
            transactionCode: nextCode,
            funderId: newFunderId,
            loanId: null,
            amount: unallocatedPortion.toFixed(2),
            fundingDate: unallocTx.fundingDate,
            status: "received",
            notes: `[Unallocated remainder from ${unallocTx.transactionCode}]`,
          });

          const [alloc] = await tx
            .insert(capitalAllocationsTable)
            .values({
              funderId: newFunderId,
              loanId,
              fundingTransactionId: unallocTx.transactionId,
              amount: allocatedPortion.toFixed(2),
              allocationDate,
              status: "active",
              notes: notes?.trim() || null,
            })
            .returning();

          if (!finalAllocationId) finalAllocationId = alloc.allocationId;
          if (!finalTxCode) finalTxCode = updatedAllocated.transactionCode;
          remainingNeeded = 0;
          break;
        }
      }

      // 7. On-demand funding for any remaining amount
      if (remainingNeeded > 0) {
        const transactionCode = await capitalRepository.getNextTransactionCode();
        const [fundingTx] = await tx
          .insert(capitalFundingTransactionsTable)
          .values({
            transactionCode,
            funderId: newFunderId,
            loanId,
            amount: remainingNeeded.toFixed(2),
            fundingDate: allocationDate,
            status: "allocated",
            notes:
              notes?.trim() ||
              `On-demand capital for ${borrower?.name || "borrower"} — Reassignment from different funder`,
          })
          .returning();

        const [alloc] = await tx
          .insert(capitalAllocationsTable)
          .values({
            funderId: newFunderId,
            loanId,
            fundingTransactionId: fundingTx.transactionId,
            amount: remainingNeeded.toFixed(2),
            allocationDate,
            status: "active",
            notes: notes?.trim() || null,
          })
          .returning();

        if (!finalAllocationId) finalAllocationId = alloc.allocationId;
        if (!finalTxCode) finalTxCode = fundingTx.transactionCode;
      }

      // 8. Audit logging
      await auditLog("capital_source_reassigned", "loan", loanId, {
        oldAllocationId: allocationId,
        newAllocationId: finalAllocationId,
        newFunderId,
        newFunderName: newFunder.name,
        amount: numAmount,
        borrowerName: borrower?.name || "Unknown",
        date: allocationDate,
      });
    });

    await invalidateLoanManagementCache().catch(() => {});
    revalidatePath("/loan-management");
    revalidatePath("/capital-management");

    return {
      success: true,
      data: { newAllocationId: finalAllocationId, transactionCode: finalTxCode },
    };
  } catch (err: any) {
    console.error("reassignCapitalSourceAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to reassign capital source.",
    };
  }
}
