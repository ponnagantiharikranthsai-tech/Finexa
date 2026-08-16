"use server";

import { applicationRepository } from "../repository/application.repository";
import { encrypt } from "@/lib/encryption";
import { auditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/types/api.types";
import { db } from "@/db/client";
import { adminNotificationsTable } from "@/db/schema";
import { sendWebPushToAllSubscriptions } from "@/features/notifications/utils/web-push";

export async function submitLoanApplicationAction(
  _prevState: ActionResult<{ code: string }> | null,
  formData: FormData
): Promise<ActionResult<{ code: string }>> {
  try {
    const code = formData.get("applicationCode") as string;
    if (!code) {
      return { success: false, error: "Application code is missing." };
    }

    const app = await applicationRepository.findByCode(code);
    if (!app) {
      return { success: false, error: "Application link not found." };
    }

    if (app.status !== "active") {
      return { success: false, error: "This link is no longer active or has already been submitted." };
    }

    // Extract fields
    const name = formData.get("name") as string;
    const mobile = formData.get("mobile") as string;
    const fatherName = formData.get("fatherName") as string;
    const fatherMobile = formData.get("fatherMobile") as string;
    const email = formData.get("email") as string;
    const address = formData.get("address") as string;
    const aadhaar = formData.get("aadhaar") as string;
    const pan = formData.get("pan") as string;
    const acceptTerms = formData.get("acceptTerms") === "true";
    const confirmCorrect = formData.get("confirmCorrect") === "true";

    // Validate fields (mandatory check)
    if (!name || name.trim().length < 2) return { success: false, error: "Full Name is required." };
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) return { success: false, error: "Enter a valid 10-digit Indian mobile number." };
    if (!fatherName || fatherName.trim().length < 2) return { success: false, error: "Father's Name is required." };
    if (!fatherMobile || !/^[6-9]\d{9}$/.test(fatherMobile)) return { success: false, error: "Enter a valid 10-digit Father's mobile number." };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Enter a valid email address." };
    if (!address || address.trim().length < 5) return { success: false, error: "Full Address is required." };
    if (!aadhaar || !/^\d{12}$/.test(aadhaar)) return { success: false, error: "Enter a valid 12-digit Aadhaar number." };
    if (!pan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())) return { success: false, error: "Enter a valid PAN number." };
    if (!acceptTerms || !confirmCorrect) return { success: false, error: "You must accept terms and confirm details to proceed." };

    // Encrypt Aadhaar & PAN
    const panEncrypted = encrypt(pan.toUpperCase());
    const aadhaarEncrypted = encrypt(aadhaar);

    // Save directly into the Applications record
    await applicationRepository.update(app.applicationId, {
      status: "pending_verification",
      customerName: name,
      customerMobile: mobile,
      customerFatherName: fatherName,
      customerFatherMobile: fatherMobile,
      customerEmail: email,
      customerAddress: address,
      customerAadhaarEncrypted: aadhaarEncrypted,
      customerPanEncrypted: panEncrypted,
    });

    // Trigger Web Push notification to admin devices immediately after successful database update
    const dedupKey = `notif_APP_${app.applicationId}_submitted`;
    const principalFormatted = Number(app.principal).toLocaleString("en-IN");
    
    console.log(`[APPLICATION SUBMISSION SUCCESS] Application ${app.applicationId} saved for ${name}.`);
    console.log(`[INSTANT WEB PUSH] Dispatching Web Push alert to registered admin devices...`);

    try {
      const pushSuccess = await sendWebPushToAllSubscriptions(dedupKey, {
        title: "FINEXA — New Loan Application",
        body: `New loan application received from ${name} for ₹${principalFormatted}.`,
        badge: "/badge.png",
        url: "/applications",
        tag: dedupKey,
      });
      console.log(`[INSTANT WEB PUSH RESULT] Web Push status for ${name}: ${pushSuccess ? "DELIVERED" : "FAILED / NO SUBSCRIPTIONS"}`);
    } catch (pushErr: any) {
      console.error("[INSTANT WEB PUSH ERROR] Failed to send Web Push alert:", pushErr?.message || pushErr);
    }

    // Notify the admin by generating an audit log
    await auditLog("application_submitted", "loan_application", app.applicationId, {
      code,
      customerName: name,
      customerMobile: mobile,
      principal: app.principal,
      status: "PENDING REVIEW",
    });

    return { success: true, data: { code } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit loan details." };
  }
}
