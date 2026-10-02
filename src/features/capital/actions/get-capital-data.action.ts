"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  fundersTable,
  capitalReturnsTable,
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
  loansTable,
  borrowersTable,
  paymentsTable,
} from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
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
  // On-Demand Metrics
  totalProvided: number;
  currentlyAllocated: number;
  unallocatedReceived: number;
  totalReturned: number;
  remainingCapital: number;
  availableCapital: number; // legacy alias for unallocatedReceived
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

    // 1. Fetch all funders
    const rawFunders = await capitalRepository.findAllFunders();
    // 2. Fetch all returns
    const rawReturns = await capitalRepository.findAllCapitalReturns();

    const returnsByFunder: Record<string, typeof rawReturns> = {};
    rawReturns.forEach((r) => {
      if (!returnsByFunder[r.funderId]) {
        returnsByFunder[r.funderId] = [];
      }
      returnsByFunder[r.funderId].push(r);
    });

    // 3. Fetch all allocations joined with loans & borrowers
    const rawAllocations = await db
      .select({
        allocation: capitalAllocationsTable,
        loan: loansTable,
        borrower: borrowersTable,
      })
      .from(capitalAllocationsTable)
      .innerJoin(loansTable, eq(capitalAllocationsTable.loanId, loansTable.loanId))
      .innerJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .orderBy(desc(capitalAllocationsTable.allocationDate));

    // 4. Fetch all funding transactions joined with loans & borrowers
    const rawTransactions = await db
      .select({
        tx: capitalFundingTransactionsTable,
        loan: loansTable,
        borrower: borrowersTable,
      })
      .from(capitalFundingTransactionsTable)
      .leftJoin(loansTable, eq(capitalFundingTransactionsTable.loanId, loansTable.loanId))
      .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .orderBy(desc(capitalFundingTransactionsTable.fundingDate), desc(capitalFundingTransactionsTable.createdAt));

    // Group transactions by funderId
    const transactionsByFunder: Record<string, FundingTransactionHistoryItem[]> = {};
    rawTransactions.forEach((item) => {
      const fId = item.tx.funderId;
      if (!transactionsByFunder[fId]) {
        transactionsByFunder[fId] = [];
      }
      transactionsByFunder[fId].push({
        transactionId: item.tx.transactionId,
        transactionCode: item.tx.transactionCode,
        amount: Number(item.tx.amount),
        fundingDate: item.tx.fundingDate,
        status: item.tx.status,
        notes: item.tx.notes,
        loanId: item.loan ? item.loan.loanId : null,
        borrowerId: item.borrower ? item.borrower.borrowerId : null,
        borrowerName: item.borrower ? item.borrower.name : null,
        borrowerMobile: item.borrower ? item.borrower.mobile : null,
        loanPrincipal: item.loan ? Number(item.loan.principal) : null,
        loanStatus: item.loan ? item.loan.status : null,
      });
    });

    // Group allocations by funderId
    const allocationsByFunder: Record<string, any[]> = {};
    rawAllocations.forEach((item) => {
      const fId = item.allocation.funderId;
      if (!allocationsByFunder[fId]) {
        allocationsByFunder[fId] = [];
      }
      const lPrincipal = Number(item.loan.principal);
      const allocatedAmount = Number(item.allocation.amount);
      const funderSharePercentage = lPrincipal > 0 ? Math.round((allocatedAmount / lPrincipal) * 100) : 0;

      allocationsByFunder[fId].push({
        allocationId: item.allocation.allocationId,
        loanId: item.loan.loanId,
        borrowerId: item.borrower.borrowerId,
        borrowerName: item.borrower.name,
        borrowerMobile: item.borrower.mobile,
        loanPrincipal: lPrincipal,
        allocatedAmount,
        funderSharePercentage,
        allocationDate: item.allocation.allocationDate,
        status: item.allocation.status,
        loanStatus: item.loan.status,
        loanDateGiven: item.loan.dateGiven,
        loanDueDate: item.loan.dueDate,
        notes: item.allocation.notes,
      });
    });

    // 5. Map funders to On-Demand model
    const funders: FunderWithReturns[] = rawFunders.map((f, idx) => {
      const funderReturns = returnsByFunder[f.funderId] || [];
      const totalReturned = funderReturns.reduce((sum, r) => sum + Number(r.amount), 0);

      const loansFunded = allocationsByFunder[f.funderId] || [];
      const currentlyAllocated = loansFunded.reduce(
        (sum, a) => (a.status === "active" ? sum + a.allocatedAmount : sum),
        0
      );

      // Funding history from transactions (or synthesized from allocations if no tx yet)
      let fundingHistory = transactionsByFunder[f.funderId] || [];
      if (fundingHistory.length === 0 && loansFunded.length > 0) {
        fundingHistory = loansFunded.map((a, i) => ({
          transactionId: a.allocationId,
          transactionCode: `CF-${String(i + 1).padStart(3, "0")}`,
          amount: a.allocatedAmount,
          fundingDate: a.allocationDate,
          status: "allocated",
          notes: a.notes,
          loanId: a.loanId,
          borrowerId: a.borrowerId,
          borrowerName: a.borrowerName,
          borrowerMobile: a.borrowerMobile,
          loanPrincipal: a.loanPrincipal,
          loanStatus: a.loanStatus,
        }));
      }

      // Total provided is sum of actual funding events
      const totalProvidedFromHistory = fundingHistory.reduce((sum, h) => sum + h.amount, 0);
      const totalProvided = Math.max(totalProvidedFromHistory, currentlyAllocated);

      // Standalone received capital (unallocated)
      const unallocatedReceived = Math.max(
        0,
        fundingHistory
          .filter((h) => h.status === "received" && !h.loanId)
          .reduce((sum, h) => sum + h.amount, 0)
      );

      return {
        funderId: f.funderId,
        name: f.name,
        mobile: f.mobile,
        address: f.address || "",
        fundingModel: f.fundingModel || "on_demand",
        capitalAmount: totalProvided,
        investmentDate: f.investmentDate,
        status: f.status as any,
        notes: f.notes,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        totalProvided,
        currentlyAllocated,
        unallocatedReceived,
        totalReturned,
        remainingCapital: Math.max(0, currentlyAllocated - totalReturned),
        availableCapital: unallocatedReceived,
        investmentIndex: idx + 1,
        totalFunderInvestments: fundingHistory.length,
        totalFunderCapitalProvided: totalProvided,
        fundingHistory,
        loansFunded,
        returnsList: funderReturns.map((r) => ({
          returnId: r.returnId,
          amount: Number(r.amount),
          returnDate: r.returnDate,
          notes: r.notes,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    });

    // 6. Global Stats
    const totalProvided = funders.reduce((sum, f) => sum + f.totalProvided, 0);
    const currentlyAllocated = funders.reduce((sum, f) => sum + f.currentlyAllocated, 0);
    const unallocatedReceived = funders.reduce((sum, f) => sum + f.unallocatedReceived, 0);
    const totalReturned = funders.reduce((sum, f) => sum + f.totalReturned, 0);
    const activeFunders = funders.filter((f) => f.status === "active").length;

    // Total loans principal in system
    const allLoans = await db.select({ principal: loansTable.principal }).from(loansTable);
    const totalOutstandingLoansPrincipal = allLoans.reduce(
      (sum, l) => sum + Number(l.principal),
      0
    );

    return {
      success: true,
      data: {
        funders,
        stats: {
          totalReceived: totalProvided,
          totalProvided,
          currentlyAllocated,
          totalReturned,
          activeCapital: currentlyAllocated,
          availableCapital: unallocatedReceived,
          unallocatedReceived,
          activeFunders,
          totalAllocated: currentlyAllocated,
          totalCapitalWithBorrowers: currentlyAllocated,
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
