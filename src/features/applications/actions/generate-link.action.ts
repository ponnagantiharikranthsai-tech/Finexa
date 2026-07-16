"use server";

import { generateLinkSchema } from "../schemas/generate-link.schema";
import { applicationRepository } from "../repository/application.repository";
import { requireAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { auditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/types/api.types";

export async function generateLinkAction(
  _prevState: ActionResult<{ code: string; url: string }> | null,
  formData: FormData
): Promise<ActionResult<{ code: string; url: string }>> {
  try {
    await requireAuth();

    const raw = Object.fromEntries(formData);
    const parsed = generateLinkSchema.safeParse(raw);
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

    // Generate unique code in format LN-YYYY-XXXXXX
    const currentYear = new Date().getFullYear();
    let code = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      code = `LN-${currentYear}-${rand}`;
      const existing = await applicationRepository.findByCode(code);
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return { success: false, error: "Failed to generate a unique code. Please try again." };
    }

    // Calculate expiry date
    let expiryDate: Date | null = null;
    if (parsed.data.expiryDays) {
      const days = Number(parsed.data.expiryDays);
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
    }

    // Insert application link
    const app = await applicationRepository.create({
      applicationCode: code,
      principal: parsed.data.principal.toString(),
      interestAmount: parsed.data.interestAmount.toString(),
      interestType: parsed.data.interestType,
      startDate: parsed.data.startDate,
      dueDate: parsed.data.dueDate,
      loanDuration: parsed.data.loanDuration,
      notes: parsed.data.notes || null,
      expiryDate: expiryDate,
      status: "active",
    });

    // Dynamically resolve application URL from request headers
    const headerStore = await headers();
    const host = headerStore.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const appUrl = `${protocol}://${host}`;
    const secureUrl = `${appUrl}/apply/${code}`;

    await auditLog("application_link_generated", "loan_application", app.applicationId, {
      code,
      principal: app.principal,
    });

    return {
      success: true,
      data: {
        code,
        url: secureUrl,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate loan link" };
  }
}
