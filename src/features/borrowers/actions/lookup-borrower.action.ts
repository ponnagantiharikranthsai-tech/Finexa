"use server";

import { borrowerRepository } from "../repository/borrower.repository";
import { decrypt } from "@/lib/encryption";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export type BorrowerLookupResult = {
  borrowerId: string;
  name: string;
  mobile: string;
  email: string | null;
  locationUrl: string | null;
};

export async function lookupBorrowerAction(
  query: string
): Promise<ActionResult<BorrowerLookupResult | null>> {
  try {
    await requireAuth();

    if (!query || query.trim().length < 3) {
      return { success: true, data: null };
    }

    const all = await borrowerRepository.findAll();
    
    for (const b of all) {
      if (
        b.mobile.includes(query) ||
        b.name.toLowerCase().includes(query.toLowerCase())
      ) {
        return {
          success: true,
          data: {
            borrowerId: b.borrowerId,
            name: b.name,
            mobile: b.mobile,
            email: b.email,
            locationUrl: b.locationUrl,
          },
        };
      }

      try {
        const decryptedPan = decrypt(b.panEncrypted);
        const decryptedAadhaar = decrypt(b.aadhaarEncrypted);
        if (decryptedPan === query.toUpperCase() || decryptedAadhaar === query) {
          return {
            success: true,
            data: {
              borrowerId: b.borrowerId,
              name: b.name,
              mobile: b.mobile,
              email: b.email,
              locationUrl: b.locationUrl,
            },
          };
        }
      } catch (e) {
        // ignore
      }
    }

    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to lookup borrower" };
  }
}
