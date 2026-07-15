"use server";

import { applicationRepository } from "../repository/application.repository";
import type { ActionResult } from "@/types/api.types";
import type { LoanApplication } from "@/db/schema";

export async function getApplicationByCodeAction(
  code: string
): Promise<ActionResult<LoanApplication>> {
  try {
    const app = await applicationRepository.findByCode(code);
    if (!app) {
      return { success: false, error: "Application link not found or invalid." };
    }

    // Check if expired based on date
    const now = new Date();
    if (app.expiryDate && new Date(app.expiryDate) < now && app.status === "active") {
      await applicationRepository.update(app.applicationId, { status: "expired" });
      return { success: false, error: "This application link has expired." };
    }

    if (app.status === "expired") {
      return { success: false, error: "This application link has expired." };
    }

    if (app.status !== "active") {
      return {
        success: false,
        error: "This application link has already been submitted and cannot be reused.",
      };
    }

    return { success: true, data: app };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to retrieve application details" };
  }
}
