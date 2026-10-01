"use server";

import { loanRepository } from "../repository/loan.repository";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import { capitalAllocationsTable, fundersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ActionResult } from "@/types/api.types";
import type { LoanWithBorrower } from "../repository/loan.repository";

export interface LoanFundingSource {
  allocationId: string;
  funderId: string;
  funderName: string;
  funderMobile: string;
  amount: number;
  funderSharePercentage: number;
  allocationDate: string;
  notes: string | null;
}

export interface LoanFundingSummary {
  totalFunded: number;
  remainingRequired: number;
  isFullyFunded: boolean;
  isPartiallyFunded: boolean;
  isUnfunded: boolean;
  sources: LoanFundingSource[];
}

export type LoanManagementDetailResult = LoanWithBorrower & {
  borrower: LoanWithBorrower["borrower"] & {
    panDecrypted: string;
    aadhaarDecrypted: string;
  };
  funding: LoanFundingSummary;
};

let cachedData: { data: LoanManagementDetailResult[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10000; // 10 seconds RAM cache

export async function invalidateLoanManagementCache() {
  cachedData = null;
}

export async function getLoanManagementDataAction(): Promise<ActionResult<LoanManagementDetailResult[]>> {
  try {
    await requireAuth();

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
      return { success: true, data: cachedData.data };
    }

    const loans = await loanRepository.findAllManagement();

    // Fetch active allocations joined with funders
    const rawAllocations = await db
      .select({
        allocationId: capitalAllocationsTable.allocationId,
        loanId: capitalAllocationsTable.loanId,
        funderId: capitalAllocationsTable.funderId,
        funderName: fundersTable.name,
        funderMobile: fundersTable.mobile,
        amount: capitalAllocationsTable.amount,
        allocationDate: capitalAllocationsTable.allocationDate,
        notes: capitalAllocationsTable.notes,
      })
      .from(capitalAllocationsTable)
      .innerJoin(fundersTable, eq(capitalAllocationsTable.funderId, fundersTable.funderId))
      .where(eq(capitalAllocationsTable.status, "active"));

    // Group allocations by loanId
    const allocationsByLoan = new Map<string, typeof rawAllocations>();
    rawAllocations.forEach((item) => {
      const list = allocationsByLoan.get(item.loanId) || [];
      list.push(item);
      allocationsByLoan.set(item.loanId, list);
    });

    const data: LoanManagementDetailResult[] = loans.map((loan) => {
      const principal = Number(loan.principal);
      const allocs = allocationsByLoan.get(loan.loanId) || [];

      const sources: LoanFundingSource[] = allocs.map((a) => {
        const amt = Number(a.amount);
        const shareRatio = principal > 0 ? (amt / principal) * 100 : 0;
        return {
          allocationId: a.allocationId,
          funderId: a.funderId,
          funderName: a.funderName,
          funderMobile: a.funderMobile,
          amount: amt,
          funderSharePercentage: Math.round(shareRatio),
          allocationDate: a.allocationDate,
          notes: a.notes,
        };
      });

      const totalFunded = sources.reduce((sum, s) => sum + s.amount, 0);
      const remainingRequired = Math.max(0, principal - totalFunded);
      const isFullyFunded = totalFunded >= principal;
      const isPartiallyFunded = totalFunded > 0 && totalFunded < principal;
      const isUnfunded = totalFunded === 0;

      return {
        ...loan,
        borrower: {
          ...loan.borrower,
          panDecrypted: "",
          aadhaarDecrypted: "",
        },
        funding: {
          totalFunded,
          remainingRequired,
          isFullyFunded,
          isPartiallyFunded,
          isUnfunded,
          sources,
        },
      };
    });

    cachedData = { data, timestamp: Date.now() };

    return { success: true, data };
  } catch (err: any) {
    console.error("getLoanManagementDataAction Error:", err);
    return { success: false, error: err.message || "Failed to fetch loan management data" };
  }
}
