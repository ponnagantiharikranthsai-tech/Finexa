"use server";

import { requireAuth } from "@/lib/auth";
import { db, withDbRetry } from "@/db/client";
import {
  fundersTable,
  capitalReturnsTable,
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
  loansTable,
  borrowersTable,
  paymentsTable,
} from "@/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { capitalRepository } from "../repository/capital.repository";
import type { ActionResult } from "@/types/api.types";

export interface LedgerTransactionItem {
  transactionId: string;
  transactionCode: string;
  amount: number;
  originalAmount: number;
  currentlyAllocated: number;
  returnedFromBorrower: number;
  fundingDate: string;
  status: "allocated" | "partially_returned" | "returned" | "received" | "pending" | "released" | string;
  type: "FUNDING" | "ADVANCE" | "RETURN";
  notes: string | null;
  loanId: string | null;
  loanCode: string | null;
  borrowerId: string | null;
  borrowerName: string | null;
  borrowerMobile: string | null;
  loanPrincipal: number | null;
  loanStatus: string | null;
  loanDueDate: string | null;
  loanDateGiven: string | null;
  createdAt: string;
  hasReceipt: boolean;
  receiptNote?: string | null;
}

export interface PaymentToCapitalPersonItem {
  returnId: string;
  paymentCode: string;
  amount: number;
  returnDate: string;
  notes: string | null;
  createdAt: string;
}

export interface BorrowerPrincipalRepaymentItem {
  paymentId: string;
  loanId: string;
  loanCode: string;
  borrowerName: string;
  borrowerMobile: string;
  amount: number;
  paymentDate: string;
  notes: string | null;
}

export interface FunderLedgerData {
  funder: {
    funderId: string;
    name: string;
    mobile: string;
    address: string;
    status: "active" | "returned" | "inactive" | string;
    fundingModel: string;
    notes: string | null;
    createdAt: string;
  };
  metrics: {
    totalProvided: number;
    totalAllocated: number;
    currentlyAllocated: number;
    returnedFromBorrower: number;
    paidBackToCapitalPerson: number;
    capitalPayable: number;
    unallocatedReceived: number;
    totalReturned: number;
    transactionCount: number;
    status: "CAPITAL SETTLED" | "PARTIALLY RETURNED" | "ACTIVE" | string;
  };
  transactions: LedgerTransactionItem[];
  paymentsToCapitalPerson: PaymentToCapitalPersonItem[];
  borrowerRepayments: BorrowerPrincipalRepaymentItem[];
}

export async function getFunderLedgerAction(
  funderId: string
): Promise<ActionResult<FunderLedgerData>> {
  try {
    await requireAuth();

    if (!funderId) {
      return { success: false, error: "Capital Person ID is required." };
    }

    // 1. Fetch funder
    const funder = await withDbRetry(() => capitalRepository.findFunderById(funderId));
    if (!funder) {
      return { success: false, error: "Capital Person not found." };
    }

    // Parallel DB queries for transactions, allocations, and capital returns
    const [rawTransactions, rawAllocations, rawReturns] = await Promise.all([
      // 1. Funding transactions for this funder
      withDbRetry(() =>
        db
          .select({
            tx: capitalFundingTransactionsTable,
            loan: loansTable,
            borrower: borrowersTable,
          })
          .from(capitalFundingTransactionsTable)
          .leftJoin(loansTable, eq(capitalFundingTransactionsTable.loanId, loansTable.loanId))
          .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
          .where(eq(capitalFundingTransactionsTable.funderId, funderId))
          .orderBy(desc(capitalFundingTransactionsTable.fundingDate), desc(capitalFundingTransactionsTable.createdAt))
      ),

      // 2. Allocations
      withDbRetry(() =>
        db
          .select({
            allocation: capitalAllocationsTable,
            loan: loansTable,
            borrower: borrowersTable,
          })
          .from(capitalAllocationsTable)
          .innerJoin(loansTable, eq(capitalAllocationsTable.loanId, loansTable.loanId))
          .innerJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
          .where(eq(capitalAllocationsTable.funderId, funderId))
          .orderBy(desc(capitalAllocationsTable.allocationDate))
      ),

      // 3. Capital returns (Paid Back to Capital Person)
      withDbRetry(() => capitalRepository.findCapitalReturnsByFunderId(funderId)).catch(() => []),
    ]);

    // Extract all unique loan IDs connected to this funder's funding events
    const loanIds = Array.from(
      new Set([
        ...rawTransactions.map((t) => t.tx.loanId).filter(Boolean),
        ...rawAllocations.map((a) => a.allocation.loanId).filter(Boolean),
      ])
    ) as string[];

    // Fetch borrower principal repayments for these loans
    const rawPrincipalPayments = loanIds.length > 0
      ? await withDbRetry(() =>
          db
            .select({
              paymentId: paymentsTable.paymentId,
              loanId: paymentsTable.loanId,
              amount: paymentsTable.amount,
              paymentDate: paymentsTable.paymentDate,
              notes: paymentsTable.notes,
              recordedAt: paymentsTable.recordedAt,
            })
            .from(paymentsTable)
            .where(
              and(
                inArray(paymentsTable.loanId, loanIds),
                eq(paymentsTable.paymentType, "principal")
              )
            )
            .orderBy(desc(paymentsTable.paymentDate), desc(paymentsTable.recordedAt))
        )
      : [];

    // Map total borrower repaid principal per loan
    const principalRepaidByLoan: Record<string, number> = {};
    rawPrincipalPayments.forEach((p) => {
      principalRepaidByLoan[p.loanId] = (principalRepaidByLoan[p.loanId] || 0) + Number(p.amount);
    });

    // Build ledger items
    const transactions: LedgerTransactionItem[] = [];

    if (rawTransactions.length > 0) {
      for (const item of rawTransactions) {
        const origAmount = Number(item.tx.amount) || 0;
        const isAdvance = item.tx.status === "received" && !item.loan;
        const txType = isAdvance ? "ADVANCE" : "FUNDING";

        const hasReceipt = Boolean(
          item.tx.notes &&
            (item.tx.notes.toLowerCase().includes("receipt") ||
              item.tx.notes.toLowerCase().includes("http") ||
              item.tx.notes.toLowerCase().includes("proof") ||
              item.tx.notes.toLowerCase().includes("utr"))
        );

        const loanCode = item.loan ? `LN-${item.loan.loanId.slice(0, 6).toUpperCase()}` : null;
        const loanPrincipal = item.loan ? Number(item.loan.principal) : 0;

        let returnedFromBorrower = 0;
        let currentlyAllocated = origAmount;
        let status = item.tx.status;

        if (item.loan && !isAdvance) {
          const repaid = principalRepaidByLoan[item.loan.loanId] || 0;
          const isClosed = item.loan.status === "closed";
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

        transactions.push({
          transactionId:        item.tx.transactionId,
          transactionCode:      item.tx.transactionCode,
          amount:               origAmount,
          originalAmount:       origAmount,
          currentlyAllocated,
          returnedFromBorrower,
          fundingDate:          item.tx.fundingDate,
          status,
          type:                 txType,
          notes:                item.tx.notes,
          loanId:               item.loan ? item.loan.loanId : null,
          loanCode,
          borrowerId:           item.borrower ? item.borrower.borrowerId : null,
          borrowerName:         item.borrower ? item.borrower.name : null,
          borrowerMobile:       item.borrower ? item.borrower.mobile : null,
          loanPrincipal:        item.loan ? Number(item.loan.principal) : null,
          loanStatus:           item.loan ? item.loan.status : null,
          loanDueDate:          item.loan ? item.loan.dueDate : null,
          loanDateGiven:        item.loan ? item.loan.dateGiven : null,
          createdAt:            item.tx.createdAt.toISOString(),
          hasReceipt,
          receiptNote:          hasReceipt ? item.tx.notes : null,
        });
      }
    } else if (rawAllocations.length > 0) {
      // Synthesize funding transactions from allocations for legacy data
      rawAllocations.forEach((item, idx) => {
        const origAmount = Number(item.allocation.amount) || 0;
        const loanCode = `LN-${item.loan.loanId.slice(0, 6).toUpperCase()}`;
        const loanPrincipal = Number(item.loan.principal) || 0;

        const repaid = principalRepaidByLoan[item.loan.loanId] || 0;
        const isClosed = item.loan.status === "closed";
        const repayRatio = isClosed ? 1.0 : (loanPrincipal > 0 ? Math.min(1.0, repaid / loanPrincipal) : 0);
        const returnedFromBorrower = Math.min(origAmount, Math.round(origAmount * repayRatio));
        const currentlyAllocated = Math.max(0, origAmount - returnedFromBorrower);

        let status = item.allocation.status as string;
        if (currentlyAllocated === 0 && origAmount > 0) {
          status = "returned";
        } else if (returnedFromBorrower > 0) {
          status = "partially_returned";
        } else {
          status = "allocated";
        }

        transactions.push({
          transactionId:        item.allocation.allocationId,
          transactionCode:      `CF-${String(idx + 1).padStart(3, "0")}`,
          amount:               origAmount,
          originalAmount:       origAmount,
          currentlyAllocated,
          returnedFromBorrower,
          fundingDate:          item.allocation.allocationDate,
          status,
          type:                 "FUNDING",
          notes:                item.allocation.notes,
          loanId:               item.loan.loanId,
          loanCode,
          borrowerId:           item.borrower.borrowerId,
          borrowerName:         item.borrower.name,
          borrowerMobile:       item.borrower.mobile,
          loanPrincipal:        Number(item.loan.principal),
          loanStatus:           item.loan.status,
          loanDueDate:          item.loan.dueDate,
          loanDateGiven:        item.loan.dateGiven,
          createdAt:            item.allocation.createdAt.toISOString(),
          hasReceipt:           false,
        });
      });
    }

    // Build Payments to Capital Person list (Finexa -> Chinni)
    const paymentsToCapitalPerson: PaymentToCapitalPersonItem[] = rawReturns.map((r, idx) => ({
      returnId:    r.returnId,
      paymentCode: r.paymentCode || `CP-${String(idx + 1).padStart(3, "0")}`,
      amount:      Number(r.amount),
      returnDate:  r.returnDate,
      notes:       r.notes || "Capital principal repaid to capital person",
      createdAt:   r.createdAt.toISOString(),
    }));

    // Also include returns in transaction list as RETURN type
    rawReturns.forEach((r, idx) => {
      transactions.push({
        transactionId:        r.returnId,
        transactionCode:      r.paymentCode || `CP-${String(idx + 1).padStart(3, "0")}`,
        amount:               Number(r.amount),
        originalAmount:       Number(r.amount),
        currentlyAllocated:   0,
        returnedFromBorrower: 0,
        fundingDate:          r.returnDate,
        status:               "released",
        type:                 "RETURN",
        notes:                r.notes || "Capital repaid to capital person",
        loanId:               null,
        loanCode:             null,
        borrowerId:           null,
        borrowerName:         null,
        borrowerMobile:       null,
        loanPrincipal:        null,
        loanStatus:           null,
        loanDueDate:          null,
        loanDateGiven:        null,
        createdAt:            r.createdAt.toISOString(),
        hasReceipt:           false,
      });
    });

    // Sort all transactions newest first
    transactions.sort((a, b) => {
      const dateA = new Date(a.fundingDate).getTime();
      const dateB = new Date(b.fundingDate).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Map borrower repayments with details
    const loanLookup = new Map<string, { code: string; name: string; mobile: string }>();
    rawTransactions.forEach((t) => {
      if (t.loan) {
        loanLookup.set(t.loan.loanId, {
          code:   `LN-${t.loan.loanId.slice(0, 6).toUpperCase()}`,
          name:   t.borrower?.name || "Borrower",
          mobile: t.borrower?.mobile || "",
        });
      }
    });
    rawAllocations.forEach((a) => {
      if (a.loan) {
        loanLookup.set(a.loan.loanId, {
          code:   `LN-${a.loan.loanId.slice(0, 6).toUpperCase()}`,
          name:   a.borrower?.name || "Borrower",
          mobile: a.borrower?.mobile || "",
        });
      }
    });

    const borrowerRepayments: BorrowerPrincipalRepaymentItem[] = rawPrincipalPayments.map((p) => {
      const info = loanLookup.get(p.loanId) || { code: "LN-—", name: "Borrower", mobile: "" };
      return {
        paymentId:      p.paymentId,
        loanId:         p.loanId,
        loanCode:       info.code,
        borrowerName:   info.name,
        borrowerMobile: info.mobile,
        amount:         Number(p.amount),
        paymentDate:    p.paymentDate,
        notes:          p.notes,
      };
    });

    // Calculate core metrics according to user rules:
    const loanFundingEvents = transactions.filter((t) => t.type === "FUNDING" && t.loanId);
    const totalLoanProvided = loanFundingEvents.reduce((sum, t) => sum + t.originalAmount, 0);
    const currentlyAllocated = loanFundingEvents.reduce((sum, t) => sum + t.currentlyAllocated, 0);
    const returnedFromBorrower = loanFundingEvents.reduce((sum, t) => sum + t.returnedFromBorrower, 0);

    const unallocatedReceived = transactions
      .filter((t) => t.type === "ADVANCE" || (t.status === "received" && !t.loanId))
      .reduce((sum, t) => sum + t.originalAmount, 0);

    const totalProvided = totalLoanProvided + unallocatedReceived;
    const paidBackToCapitalPerson = paymentsToCapitalPerson.reduce((sum, p) => sum + p.amount, 0);

    // Capital Still Payable to Chinni = Principal Returned By Borrower - Paid Back to Chinni
    const capitalPayable = Math.max(0, returnedFromBorrower - paidBackToCapitalPerson);

    // Status according to user rules
    let statusDisplay: "CAPITAL SETTLED" | "PARTIALLY RETURNED" | "ACTIVE" = "ACTIVE";
    if (totalProvided > 0) {
      if (currentlyAllocated === 0 && capitalPayable === 0) {
        statusDisplay = "CAPITAL SETTLED";
      } else if (capitalPayable > 0) {
        statusDisplay = "PARTIALLY RETURNED";
      } else if (returnedFromBorrower > 0 && capitalPayable === 0) {
        statusDisplay = "CAPITAL SETTLED";
      } else {
        statusDisplay = "ACTIVE";
      }
    }

    return {
      success: true,
      data: {
        funder: {
          funderId:     funder.funderId,
          name:         funder.name,
          mobile:       funder.mobile,
          address:      (funder as any).address || "",
          status:       funder.status,
          fundingModel: (funder as any).fundingModel || "on_demand",
          notes:        funder.notes,
          createdAt:    funder.createdAt.toISOString(),
        },
        metrics: {
          totalProvided,
          totalAllocated: currentlyAllocated,
          currentlyAllocated,
          returnedFromBorrower,
          paidBackToCapitalPerson,
          capitalPayable,
          unallocatedReceived,
          totalReturned: paidBackToCapitalPerson,
          transactionCount: loanFundingEvents.length,
          status: statusDisplay,
        },
        transactions,
        paymentsToCapitalPerson,
        borrowerRepayments,
      },
    };
  } catch (err: any) {
    console.error("getFunderLedgerAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to load funder ledger.",
    };
  }
}
