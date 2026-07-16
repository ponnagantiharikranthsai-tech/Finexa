"use server";

import { updateBorrowerSchema } from "../schemas/update-borrower.schema";
import { borrowerRepository } from "../repository/borrower.repository";
import { encrypt } from "@/lib/encryption";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import { revalidatePath } from "next/cache";

export async function updateBorrowerAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await requireAuth();

    const raw = Object.fromEntries(formData);
    const parsed = updateBorrowerSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      parsed.error.issues.forEach((err) => {
        const path = err.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(err.message);
      });
      return { success: false, error: fieldErrors };
    }

    const { borrowerId, name, mobile, email, pan, aadhaar, locationUrl } = parsed.data;

    const existing = await borrowerRepository.findById(borrowerId);
    if (!existing) {
      return { success: false, error: "Borrower not found." };
    }

    // Check duplicate mobile
    const duplicate = await borrowerRepository.findByMobile(mobile);
    if (duplicate && duplicate.borrowerId !== borrowerId) {
      return { success: false, error: "A borrower with this mobile number already exists." };
    }

    // Encrypt fields
    const panEncrypted = encrypt(pan);
    const aadhaarEncrypted = encrypt(aadhaar);

    // Save
    await borrowerRepository.update(borrowerId, {
      name,
      mobile,
      email,
      panEncrypted,
      aadhaarEncrypted,
      locationUrl: locationUrl || null,
    });

    await auditLog("borrower_updated", "borrower", borrowerId, { name, mobile });

    revalidatePath(`/borrowers/${borrowerId}`);
    revalidatePath("/borrowers");

    return { success: true, data: { success: true } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update borrower" };
  }
}
