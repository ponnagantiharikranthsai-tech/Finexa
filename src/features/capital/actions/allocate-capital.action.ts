"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  fundersTable,
  loansTable,
  borrowersTable,
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
} from "@/db/schema";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";
import { invalidateLoanManagementCache } from "@/features/loans/actions/get-loan-management-data.action";
import { capitalRepository } from "../repository/capital.repository";
import { getFunderLedgerAction } from "./get-funder-ledger.action";
import type { ActionResult } from "@/types/api.types";

export interface AllocateCapitalInput {
  loanId: string;
  funderId: string;
  amount: number;
  allocationDate?: string;
  status?: "allocated" | "pending" | "received";
  notes?: string;
}

export async function allocateCapitalAction(
  input: AllocateCapitalInput
): Promise<ActionResult<{ allocationId: string; amount: number; transactionCode: string }>> {
  try {
    await requireAuth();

    const { loanId, funderId, amount, notes } = input;
    const allocationDate =
      input.allocationDate || new Date().toISOString().split("T")[0]!;
    const fundingStatus = input.status || "allocated";

    if (!loanId || !funderId) {
      return { success: false, error: "Loan ID and Capital Person are required." };
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: "Please enter a valid funding amount greater than zero." };
    }

    // 1. Fetch Loan Details
    const [loan] = await db
      .select({
        loanId: loansTable.loanId,
        principal: loansTable.principal,
        dateGiven: loansTable.dateGiven,
        status: loansTable.status,
        borrowerId: loansTable.borrowerId,
      })
      .from(loansTable)
      .where(eq(loansTable.loanId, loanId))
      .limit(1);

    if (!loan) {
      return { success: false, error: "Loan record not found." };
    }

    // 2. Fetch Borrower Details for Audit Logging
    const [borrower] = await db
      .select({ name: borrowersTable.name, mobile: borrowersTable.mobile })
      .from(borrowersTable)
      .where(eq(borrowersTable.borrowerId, loan.borrowerId))
      .limit(1);

    // 3. Fetch Funder Details
    const [funder] = await db
      .select()
      .from(fundersTable)
      .where(eq(fundersTable.funderId, funderId))
      .limit(1);

    if (!funder) {
      return { success: false, error: "Capital Person not found." };
    }

    // 4. Validate Total Loan Principal vs Existing Allocations
    const existingLoanAllocations = await db
      .select()
      .from(capitalAllocationsTable)
      .where(
        and(
          eq(capitalAllocationsTable.loanId, loanId),
          eq(capitalAllocationsTable.status, "active")
        )
      );

    const loanPrincipal = Number(loan.principal);
    const currentLoanAllocated = existingLoanAllocations.reduce(
      (sum, a) => sum + Number(a.amount),
      0
    );
    const remainingLoanPrincipalNeeded = Math.max(0, loanPrincipal - currentLoanAllocated);

    if (numAmount > remainingLoanPrincipalNeeded) {
      return {
        success: false,
        error: `Cannot allocate ₹${numAmount.toLocaleString("en-IN")}. Loan principal is ₹${loanPrincipal.toLocaleString("en-IN")}, already funded: ₹${currentLoanAllocated.toLocaleString("en-IN")}. Remaining needed: ₹${remainingLoanPrincipalNeeded.toLocaleString("en-IN")}.`,
      };
    }

    // 5. On-Demand Funding Model:
    // Query available unallocated funding transactions from this funder to reuse first
    const unallocatedTxs = await db
      .select()
      .from(capitalFundingTransactionsTable)
      .where(
        and(
          eq(capitalFundingTransactionsTable.funderId, funderId),
          sql`(${capitalFundingTransactionsTable.loanId} IS NULL OR ${capitalFundingTransactionsTable.status} IN ('received', 'unallocated'))`,
          sql`${capitalFundingTransactionsTable.status} != 'released'`
        )
      )
      .orderBy(asc(capitalFundingTransactionsTable.createdAt));

    const ledgerRes = await getFunderLedgerAction(funderId);
    let availableUnallocated = ledgerRes.success && ledgerRes.data ? ledgerRes.data.metrics.unallocatedReceived : 0;

    let remainingNeeded = numAmount;
    let primaryAllocationId = "";
    let primaryTxCode = "";

    // Consume existing unallocated funding records first (prevents creating new advances / double counting)
    for (const tx of unallocatedTxs) {
      if (remainingNeeded <= 0 || availableUnallocated <= 0) break;
      const txAmt = Number(tx.amount) || 0;
      if (txAmt <= 0) continue;

      const usableAmt = Math.min(txAmt, availableUnallocated);
      if (usableAmt <= 0) continue;

      if (usableAmt <= remainingNeeded + 0.001) {
        // Entire unallocated record (or its usable portion) is consumed for this loan
        availableUnallocated -= usableAmt;
        // Entire unallocated record is consumed for this loan
        const [updated] = await db
          .update(capitalFundingTransactionsTable)
          .set({
            loanId,
            status: "allocated",
            fundingDate: allocationDate,
            notes: notes?.trim()
              ? `${notes.trim()} (Allocated from unallocated, previous: ${tx.notes || ""})`
              : `Allocated to ${borrower?.name || "borrower"} (Loan ID: ${loanId}). Previous: ${tx.notes || ""}`,
            updatedAt: new Date(),
          })
          .where(eq(capitalFundingTransactionsTable.transactionId, tx.transactionId))
          .returning();

        const [alloc] = await db
          .insert(capitalAllocationsTable)
          .values({
            funderId,
            loanId,
            fundingTransactionId: tx.transactionId,
            amount: txAmt.toFixed(2),
            allocationDate,
            status: "active",
            notes: notes?.trim() || null,
          })
          .returning();

        if (!primaryAllocationId) primaryAllocationId = alloc.allocationId;
        if (!primaryTxCode) primaryTxCode = updated.transactionCode;
        remainingNeeded -= txAmt;
      } else {
        // Partial consumption of this unallocated record: split into allocated portion and unallocated remainder
        const allocatedPortion = remainingNeeded;
        const unallocatedPortion = txAmt - remainingNeeded;

        const [updatedAllocated] = await db
          .update(capitalFundingTransactionsTable)
          .set({
            amount: allocatedPortion.toFixed(2),
            loanId,
            status: "allocated",
            fundingDate: allocationDate,
            notes: notes?.trim()
              ? `${notes.trim()} (Partial allocation from ${tx.transactionCode}, previous: ${tx.notes || ""})`
              : `Allocated ₹${allocatedPortion.toLocaleString("en-IN")} to ${borrower?.name || "borrower"} (Loan ID: ${loanId}). Previous: ${tx.notes || ""}`,
            updatedAt: new Date(),
          })
          .where(eq(capitalFundingTransactionsTable.transactionId, tx.transactionId))
          .returning();

        const nextCode = await capitalRepository.getNextTransactionCode();
        await db.insert(capitalFundingTransactionsTable).values({
          transactionCode: nextCode,
          funderId,
          loanId: null,
          amount: unallocatedPortion.toFixed(2),
          fundingDate: tx.fundingDate,
          status: "received",
          notes: `[Unallocated balance remaining from ${tx.transactionCode}] ${tx.notes || ""}`.trim(),
        });

        const [alloc] = await db
          .insert(capitalAllocationsTable)
          .values({
            funderId,
            loanId,
            fundingTransactionId: tx.transactionId,
            amount: allocatedPortion.toFixed(2),
            allocationDate,
            status: "active",
            notes: notes?.trim() || null,
          })
          .returning();

        if (!primaryAllocationId) primaryAllocationId = alloc.allocationId;
        if (!primaryTxCode) primaryTxCode = updatedAllocated.transactionCode;
        remainingNeeded = 0;
        break;
      }
    }

    // 6. If unallocated capital was not enough (or didn't exist), create new funding transaction for remainder
    if (remainingNeeded > 0) {
      const transactionCode = await capitalRepository.getNextTransactionCode();
      const fundingTx = await capitalRepository.createFundingTransaction({
        transactionCode,
        funderId,
        loanId,
        amount: remainingNeeded.toFixed(2),
        fundingDate: allocationDate,
        status: fundingStatus,
        notes: notes?.trim() || `On-demand funding for ${borrower?.name || "borrower"} (Loan ID: ${loanId})`,
      });

      const [alloc] = await db
        .insert(capitalAllocationsTable)
        .values({
          funderId,
          loanId,
          fundingTransactionId: fundingTx.transactionId,
          amount: remainingNeeded.toFixed(2),
          allocationDate,
          status: "active",
          notes: notes?.trim() || null,
        })
        .returning();

      if (!primaryAllocationId) primaryAllocationId = alloc.allocationId;
      if (!primaryTxCode) primaryTxCode = fundingTx.transactionCode;
    }

    // 7. Audit log & Cache Invalidation
    await auditLog("capital_allocated", "loan", loanId, {
      allocationId: primaryAllocationId,
      transactionCode: primaryTxCode,
      funderId,
      funderName: funder.name,
      borrowerName: borrower?.name || "Unknown Borrower",
      amount: numAmount,
      loanPrincipal,
      date: allocationDate,
      fundingStatus,
    });

    await invalidateLoanManagementCache().catch(() => {});

    return {
      success: true,
      data: {
        allocationId: primaryAllocationId,
        amount: numAmount,
        transactionCode: primaryTxCode,
      },
    };
  } catch (err: any) {
    console.error("allocateCapitalAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to allocate capital.",
    };
  }
}
