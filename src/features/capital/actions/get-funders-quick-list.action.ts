"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  fundersTable,
  capitalReturnsTable,
  capitalAllocationsTable,
  loansTable,
  paymentsTable,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { ActionResult } from "@/types/api.types";

export interface FunderQuickOption {
  funderId: string;
  name: string;
  mobile: string;
  totalCapital: number;
  totalReturned: number;
  activeCapital: number;
  capitalWithBorrowers: number;
  availableCapital: number;
}

export async function getFundersQuickListAction(): Promise<
  ActionResult<FunderQuickOption[]>
> {
  try {
    await requireAuth();

    // 1. Fetch all active funders
    const funders = await db
      .select()
      .from(fundersTable)
      .where(eq(fundersTable.status, "active"))
      .orderBy(fundersTable.name);

    if (funders.length === 0) {
      return { success: true, data: [] };
    }

    const funderIds = funders.map((f) => f.funderId);

    // 2. Fetch all returns for these funders
    const returns = await db
      .select({
        funderId: capitalReturnsTable.funderId,
        amount: capitalReturnsTable.amount,
      })
      .from(capitalReturnsTable)
      .where(inArray(capitalReturnsTable.funderId, funderIds));

    const returnsMap = new Map<string, number>();
    returns.forEach((r) => {
      returnsMap.set(r.funderId, (returnsMap.get(r.funderId) || 0) + Number(r.amount));
    });

    // 3. Fetch all active allocations for these funders
    const allocations = await db
      .select({
        allocationId: capitalAllocationsTable.allocationId,
        funderId: capitalAllocationsTable.funderId,
        loanId: capitalAllocationsTable.loanId,
        amount: capitalAllocationsTable.amount,
      })
      .from(capitalAllocationsTable)
      .where(
        and(
          inArray(capitalAllocationsTable.funderId, funderIds),
          eq(capitalAllocationsTable.status, "active")
        )
      );

    // 4. Calculate capital currently with borrowers
    const allocatedLoanIds = Array.from(new Set(allocations.map((a) => a.loanId)));
    const loanMap = new Map<string, { principal: number; status: string }>();

    if (allocatedLoanIds.length > 0) {
      const loans = await db
        .select({
          loanId: loansTable.loanId,
          principal: loansTable.principal,
          status: loansTable.status,
        })
        .from(loansTable)
        .where(inArray(loansTable.loanId, allocatedLoanIds));

      loans.forEach((l) => {
        loanMap.set(l.loanId, { principal: Number(l.principal), status: l.status });
      });
    }

    // Principal repayments on these loans
    const repaymentsMap = new Map<string, number>();
    if (allocatedLoanIds.length > 0) {
      const repayments = await db
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

      repayments.forEach((p) => {
        repaymentsMap.set(p.loanId, (repaymentsMap.get(p.loanId) || 0) + Number(p.amount));
      });
    }

    const funderWithBorrowersMap = new Map<string, number>();
    allocations.forEach((alloc) => {
      const l = loanMap.get(alloc.loanId);
      if (!l || l.status === "closed") return;

      const lPrincipal = l.principal;
      const lRepaid = repaymentsMap.get(alloc.loanId) || 0;
      const lRemaining = Math.max(0, lPrincipal - lRepaid);

      const ratio = lPrincipal > 0 ? Number(alloc.amount) / lPrincipal : 0;
      const withBorrower = Math.min(Number(alloc.amount), lRemaining * ratio);

      funderWithBorrowersMap.set(
        alloc.funderId,
        (funderWithBorrowersMap.get(alloc.funderId) || 0) + withBorrower
      );
    });

    // 5. Build final quick list
    const result: FunderQuickOption[] = funders.map((f) => {
      const totalCapital = Number(f.capitalAmount);
      const totalReturned = returnsMap.get(f.funderId) || 0;
      const activeCapital = Math.max(0, totalCapital - totalReturned);
      const capitalWithBorrowers = funderWithBorrowersMap.get(f.funderId) || 0;
      const availableCapital = Math.max(0, activeCapital - capitalWithBorrowers);

      return {
        funderId: f.funderId,
        name: f.name,
        mobile: f.mobile,
        totalCapital,
        totalReturned,
        activeCapital,
        capitalWithBorrowers: Math.round(capitalWithBorrowers),
        availableCapital: Math.round(availableCapital),
      };
    });

    return { success: true, data: result };
  } catch (err: any) {
    console.error("getFundersQuickListAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to load funders list.",
    };
  }
}
