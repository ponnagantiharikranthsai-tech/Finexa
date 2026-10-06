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
    // Check if there is an existing unallocated funding transaction from this funder to reuse
    const [unallocatedTx] = await db
      .select()
      .from(capitalFundingTransactionsTable)
      .where(
        and(
          eq(capitalFundingTransactionsTable.funderId, funderId),
          sql`(${capitalFundingTransactionsTable.loanId} IS NULL OR ${capitalFundingTransactionsTable.status} IN ('received', 'unallocated'))`,
          sql`CAST(${capitalFundingTransactionsTable.amount} AS NUMERIC) = ${numAmount}`
        )
      )
      .orderBy(asc(capitalFundingTransactionsTable.createdAt))
      .limit(1);

    let fundingTx: any;
    if (unallocatedTx) {
      // REUSE existing unallocated funding transaction — prevents duplicate CF creation
      const [updated] = await db
        .update(capitalFundingTransactionsTable)
        .set({
          loanId,
          status: "allocated",
          fundingDate: allocationDate,
          notes: notes?.trim() || `Reallocated to ${borrower?.name || "borrower"} (Loan ID: ${loanId}). Previous: ${unallocatedTx.notes || ""}`,
          updatedAt: new Date(),
        })
        .where(eq(capitalFundingTransactionsTable.transactionId, unallocatedTx.transactionId))
        .returning();
      fundingTx = updated;
    } else {
      const transactionCode = await capitalRepository.getNextTransactionCode();
      fundingTx = await capitalRepository.createFundingTransaction({
        transactionCode,
        funderId,
        loanId,
        amount: numAmount.toFixed(2),
        fundingDate: allocationDate,
        status: fundingStatus,
        notes: notes?.trim() || `On-demand funding for ${borrower?.name || "borrower"} (Loan ID: ${loanId})`,
      });
    }

    // 6. Insert Capital Allocation Record linked to this Funding Transaction
    const [allocation] = await db
      .insert(capitalAllocationsTable)
      .values({
        funderId,
        loanId,
        fundingTransactionId: fundingTx.transactionId,
        amount: numAmount.toFixed(2),
        allocationDate,
        status: "active",
        notes: notes?.trim() || null,
      })
      .returning();

    if (!allocation) {
      return { success: false, error: "Failed to record capital allocation in database." };
    }

    // 7. Audit log & Cache Invalidation
    await auditLog("capital_allocated", "loan", loanId, {
      allocationId: allocation.allocationId,
      transactionCode: fundingTx.transactionCode,
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
        allocationId: allocation.allocationId,
        amount: numAmount,
        transactionCode: fundingTx.transactionCode,
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
