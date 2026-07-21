"use server";

import { loanRepository } from "../repository/loan.repository";
import { decrypt } from "@/lib/encryption";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { LoanWithBorrower } from "../repository/loan.repository";

export type LoanManagementDetailResult = LoanWithBorrower & {
  borrower: LoanWithBorrower["borrower"] & {
    panDecrypted: string;
    aadhaarDecrypted: string;
  };
};

export async function getLoanManagementDataAction(): Promise<ActionResult<LoanManagementDetailResult[]>> {
  try {
    await requireAuth();
    const loans = await loanRepository.findAllManagement();

    const data = loans.map((loan) => {
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
        ...loan,
        borrower: {
          ...loan.borrower,
          panDecrypted,
          aadhaarDecrypted,
        },
      };
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch loan management data" };
  }
}
