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

    // 1. Fetch existing allocation
    const [existing] = await db
      .select({
        allocation: capitalAllocationsTable,
        oldFunderId: capitalAllocationsTable.funderId,
        oldFundingTxId: capitalAllocationsTable.fundingTransactionId,
      })
      .from(capitalAllocationsTable)
      .where(eq(capitalAllocationsTable.allocationId, allocationId))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Allocation record not found." };
    }

    // 2. Fetch new funder
    const [newFunder] = await db
      .select()
      .from(fundersTable)
      .where(eq(fundersTable.funderId, newFunderId))
      .limit(1);

    if (!newFunder) {
      return { success: false, error: "New capital person not found." };
    }

    // 3. Fetch borrower name for notes
    const [loan] = await db
      .select({ borrowerId: loansTable.borrowerId, principal: loansTable.principal })
      .from(loansTable)
      .where(eq(loansTable.loanId, loanId))
      .limit(1);

    const [borrower] = loan
      ? await db
          .select({ name: borrowersTable.name })
          .from(borrowersTable)
          .where(eq(borrowersTable.borrowerId, loan.borrowerId))
          .limit(1)
      : [null];

    // 4. Remove old allocation
    await db
      .delete(capitalAllocationsTable)
      .where(eq(capitalAllocationsTable.allocationId, allocationId));

    // Free old funding tx back to received/unallocated state
    if (existing.oldFundingTxId) {
      await db
        .update(capitalFundingTransactionsTable)
        .set({
          loanId: null,
          status: "received",
          updatedAt: new Date(),
          notes: `Freed by capital source reassignment on loan ${loanId}`,
        })
        .where(
          eq(capitalFundingTransactionsTable.transactionId, existing.oldFundingTxId)
        );
    }

    // 5. Consume new funder's unallocated capital first
    const ledgerRes = await getFunderLedgerAction(newFunderId);
    let availableUnallocated =
      ledgerRes.success && ledgerRes.data
        ? ledgerRes.data.metrics.unallocatedReceived
        : 0;

    const unallocatedTxs = await db
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
    let newAllocationId = "";
    let newTxCode = "";

    for (const tx of unallocatedTxs) {
      if (remainingNeeded <= 0 || availableUnallocated <= 0) break;
      const txAmt = Number(tx.amount) || 0;
      if (txAmt <= 0) continue;

      const usableAmt = Math.min(txAmt, availableUnallocated);
      if (usableAmt <= 0) continue;

      if (usableAmt <= remainingNeeded + 0.001) {
        availableUnallocated -= usableAmt;

        const [updated] = await db
          .update(capitalFundingTransactionsTable)
          .set({
            loanId,
            status: "allocated",
            fundingDate: allocationDate,
            updatedAt: new Date(),
            notes: `Reassigned to ${borrower?.name || "borrower"} (Loan: ${loanId}). Prev: ${tx.notes || ""}`,
          })
          .where(eq(capitalFundingTransactionsTable.transactionId, tx.transactionId))
          .returning();

        const [alloc] = await db
          .insert(capitalAllocationsTable)
          .values({
            funderId: newFunderId,
            loanId,
            fundingTransactionId: tx.transactionId,
            amount: txAmt.toFixed(2),
            allocationDate,
            status: "active",
            notes: notes?.trim() || null,
          })
          .returning();

        if (!newAllocationId) newAllocationId = alloc.allocationId;
        if (!newTxCode) newTxCode = updated.transactionCode;
        remainingNeeded -= txAmt;
      } else {
        const allocatedPortion = remainingNeeded;
        const unallocatedPortion = txAmt - remainingNeeded;

        const [updatedAllocated] = await db
          .update(capitalFundingTransactionsTable)
          .set({
            amount: allocatedPortion.toFixed(2),
            loanId,
            status: "allocated",
            fundingDate: allocationDate,
            updatedAt: new Date(),
            notes: `Partial reassignment to ${borrower?.name || "borrower"} (Loan: ${loanId})`,
          })
          .where(eq(capitalFundingTransactionsTable.transactionId, tx.transactionId))
          .returning();

        const nextCode = await capitalRepository.getNextTransactionCode();
        await db.insert(capitalFundingTransactionsTable).values({
          transactionCode: nextCode,
          funderId: newFunderId,
          loanId: null,
          amount: unallocatedPortion.toFixed(2),
          fundingDate: tx.fundingDate,
          status: "received",
          notes: `[Unallocated remainder from ${tx.transactionCode}]`,
        });

        const [alloc] = await db
          .insert(capitalAllocationsTable)
          .values({
            funderId: newFunderId,
            loanId,
            fundingTransactionId: tx.transactionId,
            amount: allocatedPortion.toFixed(2),
            allocationDate,
            status: "active",
            notes: notes?.trim() || null,
          })
          .returning();

        if (!newAllocationId) newAllocationId = alloc.allocationId;
        if (!newTxCode) newTxCode = updatedAllocated.transactionCode;
        remainingNeeded = 0;
        break;
      }
    }

    // 6. On-demand funding for any remaining amount
    if (remainingNeeded > 0) {
      const transactionCode = await capitalRepository.getNextTransactionCode();
      const fundingTx = await capitalRepository.createFundingTransaction({
        transactionCode,
        funderId: newFunderId,
        loanId,
        amount: remainingNeeded.toFixed(2),
        fundingDate: allocationDate,
        status: "allocated",
        notes:
          notes?.trim() ||
          `On-demand capital for ${borrower?.name || "borrower"} — Reassignment from different funder`,
      });

      const [alloc] = await db
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

      if (!newAllocationId) newAllocationId = alloc.allocationId;
      if (!newTxCode) newTxCode = fundingTx.transactionCode;
    }

    // 7. Audit + invalidate cache
    await auditLog("capital_source_reassigned", "loan", loanId, {
      oldAllocationId: allocationId,
      newAllocationId,
      newFunderId,
      newFunderName: newFunder.name,
      amount: numAmount,
      borrowerName: borrower?.name || "Unknown",
      date: allocationDate,
    });

    await invalidateLoanManagementCache().catch(() => {});

    return {
      success: true,
      data: { newAllocationId, transactionCode: newTxCode },
    };
  } catch (err: any) {
    console.error("reassignCapitalSourceAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to reassign capital source.",
    };
  }
}
