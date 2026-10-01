"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  fundersTable,
  loansTable,
  borrowersTable,
  capitalAllocationsTable,
  capitalReturnsTable,
  paymentsTable,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";
import { invalidateLoanManagementCache } from "@/features/loans/actions/get-loan-management-data.action";
import type { ActionResult } from "@/types/api.types";

export interface AllocateCapitalInput {
  loanId: string;
  funderId: string;
  amount: number;
  allocationDate?: string;
  notes?: string;
}

export async function allocateCapitalAction(
  input: AllocateCapitalInput
): Promise<ActionResult<{ allocationId: string; amount: number }>> {
  try {
    await requireAuth();

    const { loanId, funderId, amount, notes } = input;
    const allocationDate =
      input.allocationDate || new Date().toISOString().split("T")[0]!;

    if (!loanId || !funderId) {
      return { success: false, error: "Loan ID and Capital Person are required." };
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: "Please enter a valid allocation amount greater than zero." };
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
        error: `Cannot allocate ₹${numAmount.toLocaleString("en-IN")}. Loan principal is ₹${loanPrincipal.toLocaleString("en-IN")}, already funded: ₹${currentLoanAllocated.toLocaleString("en-IN")}. Remaining unallocated amount is ₹${remainingLoanPrincipalNeeded.toLocaleString("en-IN")}.`,
      };
    }

    // 5. Calculate Funder Available Capital
    // Funder active capital = capitalAmount - returns
    const funderReturns = await db
      .select({ amount: capitalReturnsTable.amount })
      .from(capitalReturnsTable)
      .where(eq(capitalReturnsTable.funderId, funderId));

    const totalFunderReturned = funderReturns.reduce(
      (sum, r) => sum + Number(r.amount),
      0
    );
    const funderActiveCapital = Math.max(
      0,
      Number(funder.capitalAmount) - totalFunderReturned
    );

    // Funder existing allocations
    const allFunderAllocations = await db
      .select()
      .from(capitalAllocationsTable)
      .where(
        and(
          eq(capitalAllocationsTable.funderId, funderId),
          eq(capitalAllocationsTable.status, "active")
        )
      );

    let funderCapitalCurrentlyWithBorrowers = 0;

    if (allFunderAllocations.length > 0) {
      const allocatedLoanIds = allFunderAllocations.map((a) => a.loanId);
      const allocatedLoans = await db
        .select({
          loanId: loansTable.loanId,
          principal: loansTable.principal,
          status: loansTable.status,
        })
        .from(loansTable)
        .where(inArray(loansTable.loanId, allocatedLoanIds));

      const loanMap = new Map(allocatedLoans.map((l) => [l.loanId, l]));

      // Repayments on these loans
      const principalRepayments = await db
        .select({
          loanId: paymentsTable.loanId,
          amount: paymentsTable.amount,
        })
        .from(paymentsTable)
        .where(
          and(
            inArray(paymentsTable.loanId, allocatedLoanIds),
            eq(paymentsTable.paymentType, "principal")
          )
        );

      const repaidMap = new Map<string, number>();
      principalRepayments.forEach((p) => {
        repaidMap.set(p.loanId, (repaidMap.get(p.loanId) || 0) + Number(p.amount));
      });

      for (const alloc of allFunderAllocations) {
        const l = loanMap.get(alloc.loanId);
        if (!l || l.status === "closed") continue;

        const lPrincipal = Number(l.principal);
        const lRepaid = repaidMap.get(alloc.loanId) || 0;
        const lRemaining = Math.max(0, lPrincipal - lRepaid);

        const shareRatio = lPrincipal > 0 ? Number(alloc.amount) / lPrincipal : 0;
        const allocWithBorrower = Math.min(
          Number(alloc.amount),
          lRemaining * shareRatio
        );
        funderCapitalCurrentlyWithBorrowers += allocWithBorrower;
      }
    }

    const funderAvailableCapital = Math.max(
      0,
      funderActiveCapital - funderCapitalCurrentlyWithBorrowers
    );

    if (numAmount > funderAvailableCapital) {
      return {
        success: false,
        error: `Insufficient available capital. ${funder.name} has ₹${Math.round(funderAvailableCapital).toLocaleString("en-IN")} available capital, but ₹${numAmount.toLocaleString("en-IN")} was requested.`,
      };
    }

    // 6. Insert Capital Allocation Record
    const [allocation] = await db
      .insert(capitalAllocationsTable)
      .values({
        funderId,
        loanId,
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
      funderId,
      funderName: funder.name,
      borrowerName: borrower?.name || "Unknown Borrower",
      amount: numAmount,
      loanPrincipal,
      date: allocationDate,
    });

    await invalidateLoanManagementCache().catch(() => {});

    return {
      success: true,
      data: {
        allocationId: allocation.allocationId,
        amount: numAmount,
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
