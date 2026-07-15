"use server";

import { loanRepository } from "../repository/loan.repository";
import { decrypt } from "@/lib/encryption";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { LoanWithBorrower } from "../repository/loan.repository";

export type LoanDetailResult = LoanWithBorrower & {
  borrower: LoanWithBorrower["borrower"] & {
    panDecrypted: string;
    aadhaarDecrypted: string;
  };
};

export async function getLoanByIdAction(
  id: string
): Promise<ActionResult<LoanDetailResult | null>> {
  try {
    await requireAuth();
    const loan = await loanRepository.findById(id);
    if (!loan) return { success: true, data: null };

    let panDecrypted = "";
    let aadhaarDecrypted = "";
    try {
      panDecrypted = decrypt(loan.borrower.panEncrypted);
      aadhaarDecrypted = decrypt(loan.borrower.aadhaarEncrypted);
    } catch (e) {
      panDecrypted = "DECRYPTION_ERROR";
      aadhaarDecrypted = "DECRYPTION_ERROR";
    }

    return {
      success: true,
      data: {
        ...loan,
        borrower: {
          ...loan.borrower,
          panDecrypted,
          aadhaarDecrypted,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch loan details" };
  }
}
