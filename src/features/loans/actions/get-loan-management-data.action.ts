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

let cachedData: { data: LoanManagementDetailResult[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10000; // 10 seconds RAM cache

export async function invalidateLoanManagementCache() {
  cachedData = null;
}

export async function getLoanManagementDataAction(): Promise<ActionResult<LoanManagementDetailResult[]>> {
  try {
    await requireAuth();

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
      return { success: true, data: cachedData.data };
    }

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

    cachedData = { data, timestamp: Date.now() };

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch loan management data" };
  }
}
