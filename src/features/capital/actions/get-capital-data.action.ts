"use server";

import { requireAuth } from "@/lib/auth";
import { db, withDbRetry } from "@/db/client";
import {
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
  loansTable,
  borrowersTable,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { capitalRepository } from "../repository/capital.repository";

export interface FundingTransactionHistoryItem {
  transactionId: string;
  transactionCode: string;
  amount: number;
  fundingDate: string;
  status: string;
  notes: string | null;
  loanId: string | null;
  borrowerId: string | null;
  borrowerName: string | null;
  borrowerMobile: string | null;
  loanPrincipal: number | null;
  loanStatus: string | null;
}

export interface FunderWithReturns {
  funderId: string;
  name: string;
  mobile: string;
  address: string;
  fundingModel: string;
  capitalAmount: number;
  investmentDate: string;
  status: "active" | "returned" | "inactive";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalProvided: number;
  currentlyAllocated: number;
  unallocatedReceived: number;
  totalReturned: number;
  remainingCapital: number;
  availableCapital: number;
  investmentIndex?: number;
  totalFunderInvestments?: number;
  totalFunderCapitalProvided?: number;
  fundingHistory: FundingTransactionHistoryItem[];
  loansFunded: {
    allocationId: string;
    loanId: string;
    borrowerId: string;
    borrowerName: string;
    borrowerMobile: string;
    loanPrincipal: number;
    allocatedAmount: number;
    funderSharePercentage: number;
    allocationDate: string;
    status: string;
    loanStatus: string;
    loanDateGiven: string;
    loanDueDate: string;
    notes: string | null;
  }[];
  returnsList: {
    returnId: string;
    amount: number;
    returnDate: string;
    notes: string | null;
    createdAt: string;
  }[];
}

export async function getCapitalDataAction() {
  try {
    await requireAuth();

    // ALL QUERIES RUN IN PARALLEL - eliminates sequential waterfall
    const [rawFunders, rawReturns, rawAllocations, rawTransactions, loanSumResult] =
      await Promise.all([
        withDbRetry(() => capitalRepository.findAllFunders()),
        withDbRetry(() => capitalRepository.findAllCapitalReturns()),
        withDbRetry(() =>
          db
            .select({
              allocationId:   capitalAllocationsTable.allocationId,
              funderId:       capitalAllocationsTable.funderId,
              amount:         capitalAllocationsTable.amount,
              allocationDate: capitalAllocationsTable.allocationDate,
              status:         capitalAllocationsTable.status,
              notes:          capitalAllocationsTable.notes,
              loanId:         loansTable.loanId,
              loanPrincipal:  loansTable.principal,
              loanStatus:     loansTable.status,
              loanDateGiven:  loansTable.dateGiven,
              loanDueDate:    loansTable.dueDate,
              borrowerId:     borrowersTable.borrowerId,
              borrowerName:   borrowersTable.name,
              borrowerMobile: borrowersTable.mobile,
            })
            .from(capitalAllocationsTable)
            .innerJoin(loansTable, eq(capitalAllocationsTable.loanId, loansTable.loanId))
            .innerJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
            .orderBy(desc(capitalAllocationsTable.allocationDate))
        ),
        withDbRetry(() =>
          db
            .select({
              transactionId:   capitalFundingTransactionsTable.transactionId,
              transactionCode: capitalFundingTransactionsTable.transactionCode,
              txFunderId:      capitalFundingTransactionsTable.funderId,
              txAmount:        capitalFundingTransactionsTable.amount,
              fundingDate:     capitalFundingTransactionsTable.fundingDate,
              txStatus:        capitalFundingTransactionsTable.status,
              txNotes:         capitalFundingTransactionsTable.notes,
              loanId:          loansTable.loanId,
              loanPrincipal:   loansTable.principal,
              loanStatus:      loansTable.status,
              borrowerId:      borrowersTable.borrowerId,
              borrowerName:    borrowersTable.name,
              borrowerMobile:  borrowersTable.mobile,
            })
            .from(capitalFundingTransactionsTable)
            .leftJoin(loansTable, eq(capitalFundingTransactionsTable.loanId, loansTable.loanId))
            .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
            .orderBy(
              desc(capitalFundingTransactionsTable.fundingDate),
              desc(capitalFundingTransactionsTable.createdAt)
            )
        ),
        // Single SUM aggregate - replaces fetching all loan rows just for a total
        withDbRetry(() =>
          db
            .select({ total: sql<string>`coalesce(sum(principal), '0')` })
            .from(loansTable)
        ).catch(() => [{ total: "0" }]),
      ]);

    const returnsByFunder: Record<string, typeof rawReturns> = {};
    rawReturns.forEach((r) => {
      (returnsByFunder[r.funderId] ??= []).push(r);
    });

    const transactionsByFunder: Record<string, FundingTransactionHistoryItem[]> = {};
    rawTransactions.forEach((item) => {
      (transactionsByFunder[item.txFunderId] ??= []).push({
        transactionId:   item.transactionId,
        transactionCode: item.transactionCode,
        amount:          Number(item.txAmount),
        fundingDate:     item.fundingDate,
        status:          item.txStatus,
        notes:           item.txNotes,
        loanId:          item.loanId ?? null,
        borrowerId:      item.borrowerId ?? null,
        borrowerName:    item.borrowerName ?? null,
        borrowerMobile:  item.borrowerMobile ?? null,
        loanPrincipal:   item.loanPrincipal != null ? Number(item.loanPrincipal) : null,
        loanStatus:      item.loanStatus ?? null,
      });
    });

    const allocationsByFunder: Record<string, any[]> = {};
    rawAllocations.forEach((item) => {
      const lPrincipal = Number(item.loanPrincipal);
      const allocatedAmount = Number(item.amount);
      (allocationsByFunder[item.funderId] ??= []).push({
        allocationId:          item.allocationId,
        loanId:                item.loanId,
        borrowerId:            item.borrowerId,
        borrowerName:          item.borrowerName,
        borrowerMobile:        item.borrowerMobile,
        loanPrincipal:         lPrincipal,
        allocatedAmount,
        funderSharePercentage: lPrincipal > 0 ? Math.round((allocatedAmount / lPrincipal) * 100) : 0,
        allocationDate:        item.allocationDate,
        status:                item.status,
        loanStatus:            item.loanStatus,
        loanDateGiven:         item.loanDateGiven,
        loanDueDate:           item.loanDueDate,
        notes:                 item.notes,
      });
    });

    const funders: FunderWithReturns[] = rawFunders.map((f, idx) => {
      const funderReturns      = returnsByFunder[f.funderId] || [];
      const totalReturned      = funderReturns.reduce((sum, r) => sum + Number(r.amount), 0);
      const loansFunded        = allocationsByFunder[f.funderId] || [];
      const currentlyAllocated = loansFunded.reduce(
        (sum, a) => (a.status === "active" ? sum + a.allocatedAmount : sum), 0
      );

      let fundingHistory = transactionsByFunder[f.funderId] || [];
      if (fundingHistory.length === 0 && loansFunded.length > 0) {
        fundingHistory = loansFunded.map((a, i) => ({
          transactionId:   a.allocationId,
          transactionCode: `CF-${String(i + 1).padStart(3, "0")}`,
          amount:          a.allocatedAmount,
          fundingDate:     a.allocationDate,
          status:          "allocated",
          notes:           a.notes,
          loanId:          a.loanId,
          borrowerId:      a.borrowerId,
          borrowerName:    a.borrowerName,
          borrowerMobile:  a.borrowerMobile,
          loanPrincipal:   a.loanPrincipal,
          loanStatus:      a.loanStatus,
        }));
      }

      const totalProvidedFromHistory = fundingHistory.reduce((sum, h) => sum + h.amount, 0);
      const totalProvided = Math.max(totalProvidedFromHistory, currentlyAllocated);
      const unallocatedReceived = Math.max(
        0,
        fundingHistory
          .filter((h) => h.status === "received" && !h.loanId)
          .reduce((sum, h) => sum + h.amount, 0)
      );

      return {
        funderId:                   f.funderId,
        name:                       f.name,
        mobile:                     f.mobile,
        address:                    "",
        fundingModel:               "on_demand",
        capitalAmount:              totalProvided,
        investmentDate:             f.createdAt.toISOString().split("T")[0]!,
        status:                     f.status as any,
        notes:                      f.notes,
        createdAt:                  f.createdAt.toISOString(),
        updatedAt:                  f.updatedAt.toISOString(),
        totalProvided,
        currentlyAllocated,
        unallocatedReceived,
        totalReturned,
        remainingCapital:           Math.max(0, currentlyAllocated - totalReturned),
        availableCapital:           unallocatedReceived,
        investmentIndex:            idx + 1,
        totalFunderInvestments:     fundingHistory.length,
        totalFunderCapitalProvided: totalProvided,
        fundingHistory,
        loansFunded,
        returnsList: funderReturns.map((r) => ({
          returnId:   r.returnId,
          amount:     Number(r.amount),
          returnDate: r.returnDate,
          notes:      r.notes,
          createdAt:  r.createdAt.toISOString(),
        })),
      };
    });

    const totalProvided       = funders.reduce((sum, f) => sum + f.totalProvided, 0);
    const currentlyAllocated  = funders.reduce((sum, f) => sum + f.currentlyAllocated, 0);
    const unallocatedReceived = funders.reduce((sum, f) => sum + f.unallocatedReceived, 0);
    const totalReturned       = funders.reduce((sum, f) => sum + f.totalReturned, 0);
    const activeFunders       = funders.filter((f) => f.status === "active").length;
    const totalOutstandingLoansPrincipal = Number((loanSumResult as any)?.[0]?.total || 0);

    return {
      success: true,
      data: {
        funders,
        stats: {
          totalReceived:               totalProvided,
          totalProvided,
          currentlyAllocated,
          totalReturned,
          activeCapital:               currentlyAllocated,
          availableCapital:            unallocatedReceived,
          unallocatedReceived,
          activeFunders,
          totalAllocated:              currentlyAllocated,
          totalCapitalWithBorrowers:   currentlyAllocated,
          totalOutstandingLoansPrincipal,
        },
      },
    };
  } catch (err: any) {
    console.error("getCapitalDataAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to load capital data.",
    };
  }
}
