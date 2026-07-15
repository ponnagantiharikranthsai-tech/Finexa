"use server";

import { borrowerRepository } from "../repository/borrower.repository";
import { decrypt } from "@/lib/encryption";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { Borrower } from "@/db/schema";

export type BorrowerDetailResult = Borrower & {
  panDecrypted: string;
  aadhaarDecrypted: string;
};

export async function getBorrowerByIdAction(
  id: string
): Promise<ActionResult<BorrowerDetailResult | null>> {
  try {
    await requireAuth();
    const borrower = await borrowerRepository.findById(id);
    if (!borrower) return { success: true, data: null };

    let panDecrypted = "";
    let aadhaarDecrypted = "";
    try {
      panDecrypted = decrypt(borrower.panEncrypted);
      aadhaarDecrypted = decrypt(borrower.aadhaarEncrypted);
    } catch (e) {
      // fallback if decryption fails
      panDecrypted = "DECRYPTION_ERROR";
      aadhaarDecrypted = "DECRYPTION_ERROR";
    }

    return {
      success: true,
      data: {
        ...borrower,
        panDecrypted,
        aadhaarDecrypted,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch borrower details" };
  }
}
