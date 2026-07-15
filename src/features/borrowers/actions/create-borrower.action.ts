"use server";

import { createBorrowerSchema } from "../schemas/create-borrower.schema";
import { borrowerRepository } from "../repository/borrower.repository";
import { encrypt } from "@/lib/encryption";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function createBorrowerAction(
  _prevState: ActionResult<{ borrowerId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ borrowerId: string }>> {
  try {
    await requireAuth();

    const raw = Object.fromEntries(formData);
    const parsed = createBorrowerSchema.safeParse(raw);
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

    const { name, mobile, email, pan, aadhaar, locationUrl } = parsed.data;

    const duplicate = await borrowerRepository.findByMobile(mobile);
    if (duplicate) {
      return { success: false, error: "A borrower with this mobile number already exists." };
    }

    // Encrypt fields
    const panEncrypted = encrypt(pan);
    const aadhaarEncrypted = encrypt(aadhaar);

    // Save
    const borrower = await borrowerRepository.create({
      name,
      mobile,
      email,
      panEncrypted,
      aadhaarEncrypted,
      locationUrl: locationUrl || null,
    });

    await auditLog("borrower_created", "borrower", borrower.borrowerId, { name, mobile });

    return { success: true, data: { borrowerId: borrower.borrowerId } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create borrower" };
  }
}
