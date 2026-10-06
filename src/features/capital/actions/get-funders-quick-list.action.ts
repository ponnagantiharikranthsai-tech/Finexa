"use server";

import { requireAuth } from "@/lib/auth";
import { db, withDbRetry } from "@/db/client";
import {
  fundersTable,
  capitalAllocationsTable,
  capitalFundingTransactionsTable,
  capitalReturnsTable,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { ActionResult } from "@/types/api.types";

export interface FunderQuickOption {
  funderId: string;
  name: string;
  mobile: string;
  fundingModel: string;
  totalProvided: number;
  currentlyAllocated: number;
  unallocatedReceived: number;
  // Legacy compatibility fields if needed
  totalCapital: number;
  availableCapital: number;
}

export async function getFundersQuickListAction(): Promise<
  ActionResult<FunderQuickOption[]>
> {
  try {
    await requireAuth();

    // 1. Fetch all active funders with ONLY needed fields
    const funders = await withDbRetry(() =>
      db
        .select({
          funderId: fundersTable.funderId,
          name: fundersTable.name,
          mobile: fundersTable.mobile,
          status: fundersTable.status,
          notes: fundersTable.notes,
        })
        .from(fundersTable)
        .where(eq(fundersTable.status, "active"))
        .orderBy(fundersTable.name)
    );

    if (funders.length === 0) {
      return { success: true, data: [] };
    }

    const funderIds = funders.map((f) => f.funderId);

    // 2. Fetch active allocations, transactions, and returns in parallel
    const [allocations, transactions, returns] = await Promise.all([
      withDbRetry(() =>
        db
          .select({
            funderId: capitalAllocationsTable.funderId,
            amount: capitalAllocationsTable.amount,
          })
          .from(capitalAllocationsTable)
          .where(inArray(capitalAllocationsTable.funderId, funderIds))
      ),
      withDbRetry(() =>
        db
          .select({
            funderId: capitalFundingTransactionsTable.funderId,
            amount: capitalFundingTransactionsTable.amount,
            status: capitalFundingTransactionsTable.status,
            loanId: capitalFundingTransactionsTable.loanId,
          })
          .from(capitalFundingTransactionsTable)
          .where(inArray(capitalFundingTransactionsTable.funderId, funderIds))
      ),
      withDbRetry(() =>
        db
          .select({
            funderId: capitalReturnsTable.funderId,
            amount: capitalReturnsTable.amount,
          })
          .from(capitalReturnsTable)
          .where(inArray(capitalReturnsTable.funderId, funderIds))
      ),
    ]);

    const allocationsMap = new Map<string, number>();
    allocations.forEach((a) => {
      allocationsMap.set(a.funderId, (allocationsMap.get(a.funderId) || 0) + Number(a.amount));
    });

    const returnsMap = new Map<string, number>();
    returns.forEach((r) => {
      returnsMap.set(r.funderId, (returnsMap.get(r.funderId) || 0) + Number(r.amount));
    });

    const totalProvidedMap = new Map<string, number>();
    const totalReceivedStandaloneMap = new Map<string, number>();

    transactions.forEach((t) => {
      const amt = Number(t.amount);
      totalProvidedMap.set(t.funderId, (totalProvidedMap.get(t.funderId) || 0) + amt);
      if ((t.status === "received" || t.status === "unallocated" || !t.loanId) && t.status !== "released") {
        totalReceivedStandaloneMap.set(t.funderId, (totalReceivedStandaloneMap.get(t.funderId) || 0) + amt);
      }
    });

    // 4. Build final quick list with On-Demand metrics
    const result: FunderQuickOption[] = funders.map((f) => {
      const allocated = allocationsMap.get(f.funderId) || 0;
      const returnedToPerson = returnsMap.get(f.funderId) || 0;
      // If transactions recorded, use sum of transactions; otherwise use allocations count
      const recordedProvided = totalProvidedMap.get(f.funderId) || allocated;
      const totalProvided = Math.max(recordedProvided, allocated);

      // Unallocated received net of any capital paid back to the capital person
      const standaloneReceived = totalReceivedStandaloneMap.get(f.funderId) || 0;
      const unallocatedReceived = Math.max(0, standaloneReceived - returnedToPerson);

      return {
        funderId: f.funderId,
        name: f.name,
        mobile: f.mobile,
        fundingModel: "on_demand",
        totalProvided: Math.round(totalProvided),
        currentlyAllocated: Math.round(allocated),
        unallocatedReceived: Math.round(unallocatedReceived),
        totalCapital: Math.round(totalProvided),
        availableCapital: Math.round(unallocatedReceived),
      };
    });

    return { success: true, data: result };
  } catch (err: any) {
    console.error("getFundersQuickListAction Error:", err);
    return {
      success: false,
      error: err.message || "Failed to load capital providers list.",
    };
  }
}
