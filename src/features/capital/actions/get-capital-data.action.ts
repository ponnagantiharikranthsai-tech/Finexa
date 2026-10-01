"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  fundersTable,
  capitalReturnsTable,
  capitalAllocationsTable,
  loansTable,
  borrowersTable,
  paymentsTable,
} from "@/db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { capitalRepository } from "../repository/capital.repository";

export interface FundedLoanDetail {
  allocationId: string;
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  borrowerMobile: string;
  loanPrincipal: number;
  allocatedAmount: number;
  funderSharePercentage: number;
  allocationDate: string;
  status: string; // allocation status
  loanStatus: string;
  loanDateGiven: string;
  loanDueDate: string;
  capitalWithBorrower: number;
  capitalRepaid: number;
  notes: string | null;
}

export interface FunderWithReturns {
  funderId: string;
  name: string;
  mobile: string;
  address: string;
  capitalAmount: number;
  investmentDate: string;
  returnDueDate: string;
  status: "active" | "returned";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalReturned: number;
  remainingCapital: number;
  investmentIndex?: number;
  totalFunderInvestments?: number;
  totalFunderCapitalProvided?: number;
  returnsList: {
    returnId: string;
    amount: number;
    returnDate: string;
    notes: string | null;
    createdAt: string;
  }[];
  // Connected Capital Allocation fields
  totalAllocated: number;
  capitalWithBorrowers: number;
  capitalRepaidByBorrowers: number;
  availableCapital: number;
  loansFunded: FundedLoanDetail[];
}

export async function getCapitalDataAction() {
  try {
    await requireAuth();

    // 1. Fetch all funders / investment records
    const rawFunders = await capitalRepository.findAllFunders();
    // 2. Fetch all capital returns
    const rawReturns = await capitalRepository.findAllCapitalReturns();

    // Group returns by funderId (investment ID)
    const returnsByFunder: Record<string, typeof rawReturns> = {};
    rawReturns.forEach((r) => {
      if (!returnsByFunder[r.funderId]) {
        returnsByFunder[r.funderId] = [];
      }
      returnsByFunder[r.funderId].push(r);
    });

    // 3. Fetch all active allocations joined with loans & borrowers
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

    // Fetch all principal repayments on allocated loans
    const allocatedLoanIds = Array.from(
      new Set(rawAllocations.map((a) => a.loan.loanId))
    );

    const repaymentsMap: Record<string, number> = {};
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

      repayments.forEach((r) => {
        repaymentsMap[r.loanId] = (repaymentsMap[r.loanId] || 0) + Number(r.amount);
      });
    }

    // Group funded loans by funderId
    const allocationsByFunder: Record<string, FundedLoanDetail[]> = {};

    rawAllocations.forEach((item) => {
      const fId = item.allocation.funderId;
      if (!allocationsByFunder[fId]) {
        allocationsByFunder[fId] = [];
      }

      const lPrincipal = Number(item.loan.principal);
      const lRepaid = repaymentsMap[item.loan.loanId] || 0;
      const isClosed = item.loan.status === "closed";
      const lRemaining = isClosed ? 0 : Math.max(0, lPrincipal - lRepaid);

      const allocatedAmount = Number(item.allocation.amount);
      const funderShareRatio = lPrincipal > 0 ? allocatedAmount / lPrincipal : 0;
      const funderSharePercentage = Math.round(funderShareRatio * 100);

      const capitalWithBorrower = isClosed
        ? 0
        : Math.min(allocatedAmount, Math.round(lRemaining * funderShareRatio));
      const capitalRepaid = Math.max(0, allocatedAmount - capitalWithBorrower);

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
        capitalWithBorrower,
        capitalRepaid,
        notes: item.allocation.notes,
      });
    });

    // Group all investments by normalized mobile number
    const funderGroupMap: Record<string, typeof rawFunders> = {};
    rawFunders.forEach((f) => {
      const cleanMobile = f.mobile.replace(/[^0-9]/g, "").slice(-10) || f.mobile;
      if (!funderGroupMap[cleanMobile]) {
        funderGroupMap[cleanMobile] = [];
      }
      funderGroupMap[cleanMobile].push(f);
    });

    // 4. Map investment records with returns summary, allocations, and available capital
    const funders: FunderWithReturns[] = rawFunders.map((f) => {
      const cleanMobile = f.mobile.replace(/[^0-9]/g, "").slice(-10) || f.mobile;
      const sameFunderInvestments = funderGroupMap[cleanMobile] || [f];

      // Sort investments of this funder chronologically
      sameFunderInvestments.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const investmentIndex =
        sameFunderInvestments.findIndex((inv) => inv.funderId === f.funderId) + 1;
      const totalFunderInvestments = sameFunderInvestments.length;
      const totalFunderCapitalProvided = sameFunderInvestments.reduce(
        (sum, inv) => sum + Number(inv.capitalAmount),
        0
      );

      const funderReturns = returnsByFunder[f.funderId] || [];
      const totalReturned = funderReturns.reduce((sum, r) => sum + Number(r.amount), 0);
      const remainingCapital = Math.max(0, Number(f.capitalAmount) - totalReturned);

      const loansFunded = allocationsByFunder[f.funderId] || [];
      const totalAllocated = loansFunded.reduce(
        (sum, a) => (a.status === "active" ? sum + a.allocatedAmount : sum),
        0
      );
      const capitalWithBorrowers = loansFunded.reduce(
        (sum, a) => (a.status === "active" ? sum + a.capitalWithBorrower : sum),
        0
      );
      const capitalRepaidByBorrowers = loansFunded.reduce(
        (sum, a) => (a.status === "active" ? sum + a.capitalRepaid : sum),
        0
      );

      // Available Capital = remainingCapital (after returns to funder) - capitalWithBorrowers
      const availableCapital = Math.max(0, remainingCapital - capitalWithBorrowers);

      return {
        funderId: f.funderId,
        name: f.name,
        mobile: f.mobile,
        address: f.address,
        capitalAmount: Number(f.capitalAmount),
        investmentDate: f.investmentDate,
        returnDueDate: f.returnDueDate,
        status: f.status as "active" | "returned",
        notes: f.notes,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        totalReturned,
        remainingCapital,
        investmentIndex,
        totalFunderInvestments,
        totalFunderCapitalProvided,
        returnsList: funderReturns.map((r) => ({
          returnId: r.returnId,
          amount: Number(r.amount),
          returnDate: r.returnDate,
          notes: r.notes,
          createdAt: r.createdAt.toISOString(),
        })),
        totalAllocated,
        capitalWithBorrowers,
        capitalRepaidByBorrowers,
        availableCapital,
        loansFunded,
      };
    });

    // 5. Calculate global stats
    const totalReceived = funders.reduce((sum, f) => sum + f.capitalAmount, 0);
    const totalReturned = rawReturns.reduce((sum, r) => sum + Number(r.amount), 0);
    const activeCapital = Math.max(0, totalReceived - totalReturned);

    const totalAllocated = funders.reduce((sum, f) => sum + f.totalAllocated, 0);
    const totalCapitalWithBorrowers = funders.reduce(
      (sum, f) => sum + f.capitalWithBorrowers,
      0
    );
    const availableCapital = funders.reduce((sum, f) => sum + f.availableCapital, 0);
    const activeFunders = funders.filter((f) => f.status === "active").length;

    // Calculate outstanding loans principal (active/overdue/extended/submitted)
    const activeLoans = await db
      .select({
        loanId: loansTable.loanId,
        principal: loansTable.principal,
      })
      .from(loansTable)
      .where(inArray(loansTable.status, ["submitted", "active", "overdue", "extended"]));

    let totalOutstandingLoansPrincipal = 0;
    if (activeLoans.length > 0) {
      const activeLoanIds = activeLoans.map((l) => l.loanId);
      const allActiveRepayments = await db
        .select({
          loanId: paymentsTable.loanId,
          amount: paymentsTable.amount,
        })
        .from(paymentsTable)
        .where(
          and(
            inArray(paymentsTable.loanId, activeLoanIds),
            eq(paymentsTable.paymentType, "principal")
          )
        );

      const allActiveRepaymentsMap: Record<string, number> = {};
      allActiveRepayments.forEach((r) => {
        allActiveRepaymentsMap[r.loanId] =
          (allActiveRepaymentsMap[r.loanId] || 0) + Number(r.amount);
      });

      activeLoans.forEach((loan) => {
        const paid = allActiveRepaymentsMap[loan.loanId] || 0;
        const outstanding = Math.max(0, Number(loan.principal) - paid);
        totalOutstandingLoansPrincipal += outstanding;
      });
    }

    return {
      success: true,
      data: {
        funders,
        stats: {
          totalReceived,
          totalReturned,
          activeCapital,
          availableCapital,
          activeFunders,
          totalAllocated,
          totalCapitalWithBorrowers,
          totalOutstandingLoansPrincipal,
        },
      },
    };
  } catch (err) {
    console.error("getCapitalDataAction error:", err);
    return {
      success: false,
      error: (err as Error).message || "Failed to fetch capital data.",
    };
  }
}
