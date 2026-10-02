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
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { capitalRepository } from "../repository/capital.repository";
import type { ActionResult } from "@/types/api.types";

export interface LedgerTransactionItem {
  transactionId: string;
  transactionCode: string;
  amount: number;
  fundingDate: string;
  status: "allocated" | "received" | "pending" | "released" | string;
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

export interface FunderLedgerData {
  funder: {
    funderId: string;
    name: string;
    mobile: string;
    address: string;
    status: "active" | "returned" | "inactive";
    fundingModel: string;
    notes: string | null;
    createdAt: string;
  };
  metrics: {
    totalProvided: number;
    totalAllocated: number;
    unallocatedReceived: number;
    totalReturned: number;
    transactionCount: number;
  };
  transactions: LedgerTransactionItem[];
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

    // 2. Fetch all funding transactions for this funder
    const rawTransactions = await withDbRetry(() =>
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
    );

    // 3. Fetch allocations for fallback synthesis if transactions table is empty
    const rawAllocations = await withDbRetry(() =>
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
    );

    // 4. Fetch capital returns
    const rawReturns = await withDbRetry(() => capitalRepository.findCapitalReturnsByFunderId(funderId));
    const totalReturned = rawReturns.reduce((sum, r) => sum + Number(r.amount), 0);

    // Build ledger items
    const transactions: LedgerTransactionItem[] = [];

    if (rawTransactions.length > 0) {
      for (const item of rawTransactions) {
        const amt = Number(item.tx.amount) || 0;
        const isAdvance = item.tx.status === "received" && !item.loan;
        const txType = isAdvance ? "ADVANCE" : "FUNDING";

        // Check if notes indicate a receipt or proof
        const hasReceipt = Boolean(
          item.tx.notes &&
            (item.tx.notes.toLowerCase().includes("receipt") ||
              item.tx.notes.toLowerCase().includes("http") ||
              item.tx.notes.toLowerCase().includes("proof") ||
              item.tx.notes.toLowerCase().includes("utr"))
        );

        const loanCode = item.loan ? `LN-${item.loan.loanId.slice(0, 6).toUpperCase()}` : null;

        transactions.push({
          transactionId: item.tx.transactionId,
          transactionCode: item.tx.transactionCode,
          amount: amt,
          fundingDate: item.tx.fundingDate,
          status: item.tx.status,
          type: txType,
          notes: item.tx.notes,
          loanId: item.loan ? item.loan.loanId : null,
          loanCode,
          borrowerId: item.borrower ? item.borrower.borrowerId : null,
          borrowerName: item.borrower ? item.borrower.name : null,
          borrowerMobile: item.borrower ? item.borrower.mobile : null,
          loanPrincipal: item.loan ? Number(item.loan.principal) : null,
          loanStatus: item.loan ? item.loan.status : null,
          loanDueDate: item.loan ? item.loan.dueDate : null,
          loanDateGiven: item.loan ? item.loan.dateGiven : null,
          createdAt: item.tx.createdAt.toISOString(),
          hasReceipt,
          receiptNote: hasReceipt ? item.tx.notes : null,
        });
      }
    } else if (rawAllocations.length > 0) {
      // Synthesize funding transactions from allocations for legacy or seed data
      rawAllocations.forEach((item, idx) => {
        const amt = Number(item.allocation.amount) || 0;
        const loanCode = `LN-${item.loan.loanId.slice(0, 6).toUpperCase()}`;

        transactions.push({
          transactionId: item.allocation.allocationId,
          transactionCode: `CF-${String(idx + 1).padStart(3, "0")}`,
          amount: amt,
          fundingDate: item.allocation.allocationDate,
          status: "allocated",
          type: "FUNDING",
          notes: item.allocation.notes,
          loanId: item.loan.loanId,
          loanCode,
          borrowerId: item.borrower.borrowerId,
          borrowerName: item.borrower.name,
          borrowerMobile: item.borrower.mobile,
          loanPrincipal: Number(item.loan.principal),
          loanStatus: item.loan.status,
          loanDueDate: item.loan.dueDate,
          loanDateGiven: item.loan.dateGiven,
          createdAt: item.allocation.createdAt.toISOString(),
          hasReceipt: false,
        });
      });
    }

    // Include returns as ledger entries if any exist
    rawReturns.forEach((r, idx) => {
      transactions.push({
        transactionId: r.returnId,
        transactionCode: `CR-${String(idx + 1).padStart(3, "0")}`,
        amount: Number(r.amount),
        fundingDate: r.returnDate,
        status: "released",
        type: "RETURN",
        notes: r.notes || "Capital repaid to funder",
        loanId: null,
        loanCode: null,
        borrowerId: null,
        borrowerName: null,
        borrowerMobile: null,
        loanPrincipal: null,
        loanStatus: null,
        loanDueDate: null,
        loanDateGiven: null,
        createdAt: r.createdAt.toISOString(),
        hasReceipt: false,
      });
    });

    // Sort all transactions newest first
    transactions.sort((a, b) => {
      const dateA = new Date(a.fundingDate).getTime();
      const dateB = new Date(b.fundingDate).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Calculate metrics
    const fundingOnly = transactions.filter((t) => t.type === "FUNDING" || t.type === "ADVANCE");
    const totalProvided = fundingOnly.reduce((sum, t) => sum + t.amount, 0);

    const totalAllocated = transactions
      .filter((t) => t.type === "FUNDING" && t.status === "allocated")
      .reduce((sum, t) => sum + t.amount, 0);

    const unallocatedReceived = transactions
      .filter((t) => t.type === "ADVANCE" || (t.status === "received" && !t.loanId))
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      success: true,
      data: {
        funder: {
          funderId: funder.funderId,
          name: funder.name,
          mobile: funder.mobile,
          address: funder.address || "",
          status: funder.status,
          fundingModel: funder.fundingModel || "on_demand",
          notes: funder.notes,
          createdAt: funder.createdAt.toISOString(),
        },
        metrics: {
          totalProvided,
          totalAllocated,
          unallocatedReceived,
          totalReturned,
          transactionCount: fundingOnly.length,
        },
        transactions,
      },
    };
  } catch (err: any) {
    console.error("getFunderLedgerAction Error:", err);
    // Distinguish DB connection failures from genuine "not found" situations
    const isConnectionError =
      err?.code === "ECONNRESET" ||
      err?.code === "ECONNREFUSED" ||
      err?.code === "ETIMEDOUT" ||
      err?.cause?.code === "ECONNRESET" ||
      err?.cause?.code === "ECONNREFUSED" ||
      err?.message?.includes("ECONNRESET") ||
      err?.message?.includes("Failed query") ||
      err?.message?.includes("Connection terminated") ||
      err?.message?.includes("connect ECONNREFUSED");

    return {
      success: false,
      error: isConnectionError
        ? "DB_CONNECTION_ERROR: Unable to reach the database. Please retry."
        : err.message || "Failed to load capital funding ledger.",
    };
  }
}
