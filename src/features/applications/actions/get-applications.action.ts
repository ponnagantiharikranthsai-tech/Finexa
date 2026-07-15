"use server";

import { applicationRepository, type ApplicationWithBorrower } from "../repository/application.repository";
import { requireAuth } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import type { ActionResult, PaginatedResult } from "@/types/api.types";

export async function getApplicationsAction(
  filters: { search?: string; status?: string },
  page = 1,
  pageSize = 20
): Promise<ActionResult<PaginatedResult<ApplicationWithBorrower>>> {
  try {
    await requireAuth();
    const result = await applicationRepository.findMany(filters, { page, pageSize });

    // Decrypt borrower sensitive fields on the server for the admin
    const decryptedData = result.data.map((app) => {
      if (app.borrower) {
        try {
          if (app.borrower.panEncrypted) {
            app.borrower.panEncrypted = decrypt(app.borrower.panEncrypted);
          }
          if (app.borrower.aadhaarEncrypted) {
            app.borrower.aadhaarEncrypted = decrypt(app.borrower.aadhaarEncrypted);
          }
        } catch (e) {}
      }
      if (app.customerPanEncrypted) {
        try {
          app.customerPanEncrypted = decrypt(app.customerPanEncrypted);
        } catch (e) {}
      }
      if (app.customerAadhaarEncrypted) {
        try {
          app.customerAadhaarEncrypted = decrypt(app.customerAadhaarEncrypted);
        } catch (e) {}
      }
      return app;
    });

    return {
      success: true,
      data: {
        ...result,
        data: decryptedData,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch applications" };
  }
}
