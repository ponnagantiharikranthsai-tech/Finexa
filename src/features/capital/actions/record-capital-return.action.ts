"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { getFunderLedgerAction } from "./get-funder-ledger.action";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { auditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/types/api.types";

export interface RecordCapitalReturnInput {
  funderId: string;
  amount: number | string;
  returnDate: string;
  notes?: string;
  fundingTransactionId?: string;
}

export async function recordCapitalReturnAction(
  prevStateOrData: any,
  maybeFormData?: FormData
): Promise<ActionResult<{ paymentCode: string; amount: number }>> {
  try {
    await requireAuth();

    let funderId = "";
    let amountStr = "";
    let returnDate = "";
    let notes: string | null = null;
    let fundingTransactionId: string | null = null;

    if (maybeFormData instanceof FormData) {
      funderId = (maybeFormData.get("funderId") as string) || "";
      amountStr = (maybeFormData.get("amount") as string) || "";
      returnDate = (maybeFormData.get("returnDate") as string) || "";
      notes = (maybeFormData.get("notes") as string) || null;
      fundingTransactionId = (maybeFormData.get("fundingTransactionId") as string) || null;
    } else if (prevStateOrData instanceof FormData) {
      funderId = (prevStateOrData.get("funderId") as string) || "";
      amountStr = (prevStateOrData.get("amount") as string) || "";
      returnDate = (prevStateOrData.get("returnDate") as string) || "";
      notes = (prevStateOrData.get("notes") as string) || null;
      fundingTransactionId = (prevStateOrData.get("fundingTransactionId") as string) || null;
    } else if (typeof prevStateOrData === "object" && prevStateOrData !== null) {
      funderId = prevStateOrData.funderId || "";
      amountStr = String(prevStateOrData.amount || "");
      returnDate = prevStateOrData.returnDate || "";
      notes = prevStateOrData.notes || null;
      fundingTransactionId = prevStateOrData.fundingTransactionId || null;
    }

    if (!funderId || !amountStr || !returnDate) {
      return { success: false, error: "Capital person, amount, and return date are required." };
    }

    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: "Return amount must be a positive number greater than zero." };
    }

    const funder = await capitalRepository.findFunderById(funderId);
    if (!funder) {
      return { success: false, error: "Capital Person not found." };
    }

    // Overpayment validation:
    // Determine maximum available principal returned by borrowers that has not yet been paid back
    const ledgerRes = await getFunderLedgerAction(funderId);
    if (!ledgerRes.success || !ledgerRes.data) {
      return { success: false, error: "Failed to verify available capital balance." };
    }

    const capitalPayable = ledgerRes.data.metrics.capitalPayable;
    if (amount > capitalPayable) {
      return {
        success: false,
        error: `Maximum payable amount is ₹${capitalPayable.toLocaleString("en-IN")}. Overpayment is not allowed.`,
      };
    }

    // Determine how much of this return comes from unallocated capital vs returned borrower principal
    const returnedFromBorrower = ledgerRes.data.metrics.returnedFromBorrower;
    const alreadyPaidBack = ledgerRes.data.metrics.paidBackToCapitalPerson;
    const borrowerRepaidAvailable = Math.max(0, returnedFromBorrower - alreadyPaidBack);
    const neededFromUnallocated = Math.max(0, amount - borrowerRepaidAvailable);

    // Safely mark unallocated funding records as released/returned without deleting them
    if (neededFromUnallocated > 0) {
      const { db } = await import("@/db/client");
      const { capitalFundingTransactionsTable } = await import("@/db/schema");
      const { eq, and, sql, asc } = await import("drizzle-orm");

      const unallocatedTxs = await db
        .select()
        .from(capitalFundingTransactionsTable)
        .where(
          and(
            eq(capitalFundingTransactionsTable.funderId, funderId),
            sql`(${capitalFundingTransactionsTable.loanId} IS NULL OR ${capitalFundingTransactionsTable.status} IN ('received', 'unallocated'))`,
            sql`${capitalFundingTransactionsTable.status} != 'released'`
          )
        )
        .orderBy(asc(capitalFundingTransactionsTable.createdAt));

      let remToRelease = neededFromUnallocated;
      for (const tx of unallocatedTxs) {
        if (remToRelease <= 0) break;
        const txAmt = Number(tx.amount) || 0;
        if (txAmt <= 0) continue;

        if (txAmt <= remToRelease + 0.001) {
          // Entire funding transaction is returned back to the capital person
          await db
            .update(capitalFundingTransactionsTable)
            .set({
              status: "released",
              notes: `${tx.notes || ""} [Capital principal returned to person on ${returnDate}]`.trim(),
              updatedAt: new Date(),
            })
            .where(eq(capitalFundingTransactionsTable.transactionId, tx.transactionId));
          remToRelease -= txAmt;
        } else {
          // Partial return of this transaction: split the paid amount and keep unallocated remainder
          const releasedAmt = remToRelease;
          const remainingUnallocatedAmt = txAmt - remToRelease;

          await db
            .update(capitalFundingTransactionsTable)
            .set({
              amount: releasedAmt.toFixed(2),
              status: "released",
              notes: `${tx.notes || ""} [Partial capital principal returned to person on ${returnDate}]`.trim(),
              updatedAt: new Date(),
            })
            .where(eq(capitalFundingTransactionsTable.transactionId, tx.transactionId));

          const nextCode = await capitalRepository.getNextTransactionCode();
          await db.insert(capitalFundingTransactionsTable).values({
            transactionCode: nextCode,
            funderId,
            loanId: null,
            amount: remainingUnallocatedAmt.toFixed(2),
            fundingDate: tx.fundingDate,
            status: "received",
            notes: `[Unallocated balance remaining from ${tx.transactionCode}] ${tx.notes || ""}`.trim(),
          });

          remToRelease = 0;
          break;
        }
      }
    }

    // Insert capital return
    const inserted = await capitalRepository.createCapitalReturn({
      funderId,
      amount: amount.toFixed(2),
      returnDate,
      fundingTransactionId: fundingTransactionId || null,
      notes: notes || "Principal repaid to capital person",
    });

    await auditLog("capital_returned", "funder", funderId, {
      amount,
      paymentCode: inserted.paymentCode,
      funderName: funder.name,
      returnDate,
    });

    safeRevalidatePath("/capital-management");

    return {
      success: true,
      data: {
        paymentCode: inserted.paymentCode || "CP-001",
        amount,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record capital return." };
  }
}
