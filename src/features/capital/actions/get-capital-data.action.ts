"use server";

import { requireAuth } from "@/lib/auth";
import { db, withDbRetry } from "@/db/client";
import {
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
  loansTable,
  borrowersTable,
  paymentsTable,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { capitalRepository } from "../repository/capital.repository";

export interface FundingTransactionHistoryItem {
  transactionId: string;
  transactionCode: string;
  amount: number;
  originalAmount: number;
  currentlyAllocated: number;
  returnedFromBorrower: number;
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
  status: "active" | "returned" | "inactive" | "settled" | "partially_returned";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalProvided: number;
  currentlyAllocated: number;
  returnedFromBorrower: number;
  paidBackToCapitalPerson: number;
  capitalPayable: number;
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
    currentlyAllocated: number;
    returnedFromBorrower: number;
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
    paymentCode?: string;
    amount: number;
    returnDate: string;
    notes: string | null;
    createdAt: string;
  }[];
}

export async function getCapitalDataAction() {
  try {
    await requireAuth();

    // ALL QUERIES RUN IN PARALLEL
    const [rawFunders, rawReturns, rawAllocations, rawTransactions, loanSumResult, rawPrincipalPayments] =
      await Promise.all([
        withDbRetry(() => capitalRepository.findAllFunders()),
        withDbRetry(() => capitalRepository.findAllCapitalReturns()).catch(() => []),
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
        // Aggregate sum of all loan principals
        withDbRetry(() =>
          db
            .select({ total: sql<string>`coalesce(sum(principal), '0')` })
            .from(loansTable)
        ).catch(() => [{ total: "0" }]),
        // Principal repayments from borrowers across all loans
        withDbRetry(() =>
          db
            .select({
              loanId: paymentsTable.loanId,
              amount: paymentsTable.amount,
            })
            .from(paymentsTable)
            .where(eq(paymentsTable.paymentType, "principal"))
        ),
      ]);

    // Group borrower principal repayments by loanId
    const principalRepaidByLoan: Record<string, number> = {};
    rawPrincipalPayments.forEach((p) => {
      if (p.loanId) {
        principalRepaidByLoan[p.loanId] = (principalRepaidByLoan[p.loanId] || 0) + Number(p.amount);
      }
    });

    // Group returns by funder
    const returnsByFunder: Record<string, any[]> = {};
    rawReturns.forEach((r) => {
      (returnsByFunder[r.funderId] ??= []).push(r);
    });

    // Helper to extract previously allocated loan info from notes if loan was deleted
    function parsePreviousLoanFromNotes(notes: string | null) {
      if (!notes) return { borrowerName: null, loanId: null };
      const prevMatch = notes.match(/Previously allocated to\s+([^(\r\n]+?)(?:\s*\(Loan ID:\s*([a-f0-9\-]+)|\s*-\s*Deleted|\s*$)/i);
      if (prevMatch) {
        return {
          borrowerName: prevMatch[1]?.trim() || null,
          loanId: prevMatch[2]?.trim() || null,
        };
      }
      const onDemandMatch = notes.match(/On-demand funding for\s+([^(\r\n]+?)(?:\s*\(Loan ID:\s*([a-f0-9\-]+)|\s*$)/i);
      if (onDemandMatch) {
        return {
          borrowerName: onDemandMatch[1]?.trim() || null,
          loanId: onDemandMatch[2]?.trim() || null,
        };
      }
      return { borrowerName: null, loanId: null };
    }

    // Group transactions by funder with principal repayment tracking
    const transactionsByFunder: Record<string, FundingTransactionHistoryItem[]> = {};
    rawTransactions.forEach((item) => {
      const origAmount = Number(item.txAmount);
      const loanPrincipal = item.loanPrincipal != null ? Number(item.loanPrincipal) : 0;
      
      const prevInfo = parsePreviousLoanFromNotes(item.txNotes);
      const isReleased = item.txStatus === "released";
      const isDeletedLoan = !item.loanId && Boolean(prevInfo.borrowerName || prevInfo.loanId);
      const isUnallocated = !isReleased && (!item.loanId || item.txStatus === "received" || item.txStatus === "unallocated");

      let returnedFromBorrower = 0;
      let currentlyAllocated = isUnallocated || isReleased ? 0 : origAmount;
      let status = isReleased ? "released" : isUnallocated ? "unallocated" : item.txStatus;

      if (item.loanId && !isUnallocated) {
        const repaid = principalRepaidByLoan[item.loanId] || 0;
        const isClosed = item.loanStatus === "closed";
        const repayRatio = isClosed ? 1.0 : (loanPrincipal > 0 ? Math.min(1.0, repaid / loanPrincipal) : 0);
        returnedFromBorrower = Math.min(origAmount, Math.round(origAmount * repayRatio));
        currentlyAllocated = Math.max(0, origAmount - returnedFromBorrower);

        if (currentlyAllocated === 0 && origAmount > 0) {
          status = "returned";
        } else if (returnedFromBorrower > 0) {
          status = "partially_returned";
        } else {
          status = "allocated";
        }
      }

      (transactionsByFunder[item.txFunderId] ??= []).push({
        transactionId:        item.transactionId,
        transactionCode:      item.transactionCode,
        amount:               origAmount,
        originalAmount:       origAmount,
        currentlyAllocated,
        returnedFromBorrower,
        fundingDate:          item.fundingDate,
        status,
        notes:                item.txNotes,
        loanId:               item.loanId ?? null,
        borrowerId:           item.borrowerId ?? null,
        borrowerName:         item.borrowerName ?? (isDeletedLoan ? prevInfo.borrowerName : null),
        borrowerMobile:       item.borrowerMobile ?? null,
        loanPrincipal:        item.loanPrincipal != null ? Number(item.loanPrincipal) : null,
        loanStatus:           item.loanStatus ?? (isDeletedLoan ? "Deleted" : null),
      });
    });

    // Group allocations by funder with principal repayment tracking
    const allocationsByFunder: Record<string, any[]> = {};
    rawAllocations.forEach((item) => {
      const lPrincipal = Number(item.loanPrincipal);
      const allocatedAmount = Number(item.amount);
      const repaid = principalRepaidByLoan[item.loanId] || 0;
      const isClosed = item.loanStatus === "closed";
      const repayRatio = isClosed ? 1.0 : (lPrincipal > 0 ? Math.min(1.0, repaid / lPrincipal) : 0);
      const returnedFromBorrower = Math.min(allocatedAmount, Math.round(allocatedAmount * repayRatio));
      const currentlyAllocated = Math.max(0, allocatedAmount - returnedFromBorrower);

      let status: string = item.status;
      if (currentlyAllocated === 0 && allocatedAmount > 0) {
        status = "returned";
      } else if (returnedFromBorrower > 0) {
        status = "partially_returned";
      }

      (allocationsByFunder[item.funderId] ??= []).push({
        allocationId:          item.allocationId,
        loanId:                item.loanId,
        borrowerId:            item.borrowerId,
        borrowerName:          item.borrowerName,
        borrowerMobile:        item.borrowerMobile,
        loanPrincipal:         lPrincipal,
        allocatedAmount,
        currentlyAllocated,
        returnedFromBorrower,
        funderSharePercentage: lPrincipal > 0 ? Math.round((allocatedAmount / lPrincipal) * 100) : 0,
        allocationDate:        item.allocationDate,
        status,
        loanStatus:            item.loanStatus,
        loanDateGiven:         item.loanDateGiven,
        loanDueDate:           item.loanDueDate,
        notes:                 item.notes,
      });
    });

    const funders: FunderWithReturns[] = rawFunders.map((f, idx) => {
      const funderReturns = returnsByFunder[f.funderId] || [];
      const paidBackToCapitalPerson = funderReturns.reduce((sum, r) => sum + Number(r.amount), 0);
      const loansFunded = allocationsByFunder[f.funderId] || [];

      let fundingHistory = transactionsByFunder[f.funderId] || [];
      if (fundingHistory.length === 0 && loansFunded.length > 0) {
        fundingHistory = loansFunded.map((a, i) => ({
          transactionId:        a.allocationId,
          transactionCode:      `CF-${String(i + 1).padStart(3, "0")}`,
          amount:               a.allocatedAmount,
          originalAmount:       a.allocatedAmount,
          currentlyAllocated:   a.currentlyAllocated,
          returnedFromBorrower: a.returnedFromBorrower,
          fundingDate:          a.allocationDate,
          status:               a.status,
          notes:                a.notes,
          loanId:               a.loanId,
          borrowerId:           a.borrowerId,
          borrowerName:         a.borrowerName,
          borrowerMobile:       a.borrowerMobile,
          loanPrincipal:        a.loanPrincipal,
          loanStatus:           a.loanStatus,
        }));
      }

      // Calculations according to exact business rules:
      // 1. Original Provided: sum of all funding events
      const totalProvided = fundingHistory.reduce((sum, h) => sum + h.originalAmount, 0);

      // 2. Currently Allocated to Borrower = sum of remaining active allocation
      const loanFundingEvents = fundingHistory.filter((h) => h.loanId && h.status !== "received" && h.status !== "unallocated" && h.status !== "released");
      const currentlyAllocated = loanFundingEvents.reduce((sum, h) => sum + h.currentlyAllocated, 0);

      // 3. Principal Returned From Borrower = sum of borrower repaid principal
      const returnedFromBorrower = loanFundingEvents.reduce((sum, h) => sum + h.returnedFromBorrower, 0);

      // Standalone received / unallocated capital (advances or recovered from deleted loans)
      const unallocatedReceived = fundingHistory
        .filter((h) => (!h.loanId || h.status === "received" || h.status === "unallocated") && h.status !== "released")
        .reduce((sum, h) => sum + h.originalAmount, 0);

      // 4. Capital Still Payable to Person = Total Provided - Currently Allocated - Paid Back to Capital Person
      const capitalPayable = Math.max(0, totalProvided - currentlyAllocated - paidBackToCapitalPerson);

      // Status determination
      let status: any = f.status;
      if (totalProvided > 0) {
        if (currentlyAllocated === 0 && capitalPayable === 0) {
          status = "settled"; // CAPITAL SETTLED
        } else if (paidBackToCapitalPerson > 0 && capitalPayable > 0) {
          status = "partially_returned"; // PARTIALLY RETURNED
        } else if (paidBackToCapitalPerson > 0 && capitalPayable === 0) {
          status = "settled";
        } else {
          status = "active";
        }
      }

      return {
        funderId:                   f.funderId,
        name:                       f.name,
        mobile:                     f.mobile,
        address:                    "",
        fundingModel:               "on_demand",
        capitalAmount:              totalProvided,
        investmentDate:             f.createdAt.toISOString().split("T")[0]!,
        status,
        notes:                      f.notes,
        createdAt:                  f.createdAt.toISOString(),
        updatedAt:                  f.updatedAt.toISOString(),
        totalProvided,
        currentlyAllocated,
        returnedFromBorrower,
        paidBackToCapitalPerson,
        capitalPayable,
        unallocatedReceived,
        totalReturned:              paidBackToCapitalPerson,
        remainingCapital:           currentlyAllocated,
        availableCapital:           capitalPayable,
        investmentIndex:            idx + 1,
        totalFunderInvestments:     fundingHistory.length,
        totalFunderCapitalProvided: totalProvided,
        fundingHistory,
        loansFunded,
        returnsList: funderReturns.map((r, rIdx) => ({
          returnId:    r.returnId,
          paymentCode: r.paymentCode || `CP-${String(rIdx + 1).padStart(3, "0")}`,
          amount:      Number(r.amount),
          returnDate:  r.returnDate,
          notes:       r.notes,
          createdAt:   r.createdAt.toISOString(),
        })),
      };
    });

    const totalProvided            = funders.reduce((sum, f) => sum + f.totalProvided, 0);
    const currentlyAllocated       = funders.reduce((sum, f) => sum + f.currentlyAllocated, 0);
    const returnedFromBorrower     = funders.reduce((sum, f) => sum + f.returnedFromBorrower, 0);
    const paidBackToCapitalPerson  = funders.reduce((sum, f) => sum + f.paidBackToCapitalPerson, 0);
    const capitalPayable           = funders.reduce((sum, f) => sum + f.capitalPayable, 0);
    const unallocatedReceived      = funders.reduce((sum, f) => sum + f.unallocatedReceived, 0);
    const activeFunders            = funders.filter((f) => f.status === "active" || f.status === "partially_returned").length;
    const totalOutstandingLoansPrincipal = Number((loanSumResult as any)?.[0]?.total || 0);

    return {
      success: true,
      data: {
        funders,
        stats: {
          totalReceived:               totalProvided,
          totalProvided,
          currentlyAllocated,
          returnedFromBorrower,
          paidBackToCapitalPerson,
          capitalPayable,
          totalReturned:               paidBackToCapitalPerson,
          activeCapital:               currentlyAllocated,
          availableCapital:            capitalPayable,
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
