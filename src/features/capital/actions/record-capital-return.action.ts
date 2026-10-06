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
