"use server";

import { applicationRepository } from "../repository/application.repository";
import { borrowerRepository } from "@/features/borrowers/repository/borrower.repository";
import { loanRepository } from "@/features/loans/repository/loan.repository";
import { calculatePeriods } from "@/domain/interest-calculator";
import { auditLog } from "@/lib/audit-log";
import { smsService } from "@/services/sms/sms.service";
import { db } from "@/db/client";
import { notificationsLogTable } from "@/db/schema";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import type { ActionResult } from "@/types/api.types";
import { decrypt } from "@/lib/encryption";

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables for Admin Client.");
  }
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey);
  return supabaseAdminInstance;
}

export async function verifyApplicationAction(
  applicationId: string,
  actionType: "approve" | "reject"
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await requireAuth();

    const app = await applicationRepository.findById(applicationId);
    if (!app) {
      return { success: false, error: "Application not found." };
    }

    if (app.status !== "pending_verification") {
      return { success: false, error: "Only applications pending verification can be verified." };
    }

    if (actionType === "reject") {
      // 1. REJECT LOGIC
      await applicationRepository.update(applicationId, {
        status: "rejected",
      });

      await auditLog("application_rejected", "loan_application", applicationId, {
        code: app.applicationCode,
      });

      return { success: true, data: { success: true } };
    }

    // 2. APPROVE LOGIC
    // Ensure customer details exist
    if (!app.customerName || !app.customerMobile) {
      return { success: false, error: "Customer KYC data is missing on this application." };
    }

    const name = app.customerName;
    const mobile = app.customerMobile;
    const email = app.customerEmail || "";
    const address = app.customerAddress || "";
    const fatherName = app.customerFatherName || "";
    const fatherMobile = app.customerFatherMobile || "";
    const panEncrypted = app.customerPanEncrypted || "";
    const aadhaarEncrypted = app.customerAadhaarEncrypted || "";

    // Find or create Borrower profile
    let borrowerId = "";
    const existingBorrower = await borrowerRepository.findByMobile(mobile);

    if (existingBorrower) {
      borrowerId = existingBorrower.borrowerId;
      await borrowerRepository.update(borrowerId, {
        name,
        email,
        fatherName,
        fatherMobile,
        address,
        panEncrypted,
        aadhaarEncrypted,
      });
    } else {
      const newB = await borrowerRepository.create({
        name,
        mobile,
        email,
        panEncrypted,
        aadhaarEncrypted,
        fatherName,
        fatherMobile,
        address,
        district: null,
        state: null,
        pinCode: null,
        locationUrl: null,
        aadhaarFrontUrl: null,
        aadhaarBackUrl: null,
        panCardUrl: null,
        selfieUrl: null,
        signatureUrl: null,
      });
      borrowerId = newB.borrowerId;
    }

    // Calculate interest rate
    const periods = calculatePeriods(app.startDate, app.dueDate);
    const calculatedRate = (Number(app.interestAmount) * 1000) / (Number(app.principal) * periods);

    // Create loan with status 'active'
    const loan = await loanRepository.create({
      borrowerId,
      principal: app.principal,
      interestType: app.interestType,
      interestRate: calculatedRate.toFixed(4),
      dateGiven: app.startDate,
      dueDate: app.dueDate,
      status: "active",
      penaltyAmount: "0",
    });

    // Decrypt fields for PDF output
    let decryptedPan = "N/A";
    let decryptedAadhaar = "N/A";
    try {
      if (panEncrypted) decryptedPan = decrypt(panEncrypted);
      if (aadhaarEncrypted) decryptedAadhaar = decrypt(aadhaarEncrypted);
    } catch (e) {
      console.error("Failed to decrypt fields for PDF", e);
    }

    // Generate PDF agreement
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Draw Agreement Template
    doc.setFillColor(28, 28, 30);
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(212, 168, 67);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("FINEXA LOAN AGREEMENT", 20, 25);

    doc.setTextColor(152, 152, 157);
    doc.setFontSize(10);
    doc.text(`Reference: ${app.applicationCode}`, 150, 25);

    // Content Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("Helvetica", "bold");
    doc.text("LOAN DETAILS", 20, 55);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);

    const loanDetails = [
      ["Principal Amount:", `Rs. ${Number(app.principal).toLocaleString("en-IN")}`],
      ["Interest Amount:", `Rs. ${Number(app.interestAmount).toLocaleString("en-IN")}`],
      ["Period Type:", app.interestType === "monthly" ? "Monthly" : "Daily"],
      ["Duration:", app.loanDuration],
      ["Start Date:", app.startDate],
      ["Due Date:", app.dueDate],
      ["Total Repayment Amount:", `Rs. ${(Number(app.principal) + Number(app.interestAmount)).toLocaleString("en-IN")}`],
    ];

    let y = 62;
    loanDetails.forEach(([label, value]) => {
      doc.setFont("Helvetica", "bold");
      doc.text(label!, 20, y);
      doc.setFont("Helvetica", "normal");
      doc.text(value!, 75, y);
      y += 6;
    });

    y += 5;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("CUSTOMER KYC DETAILS", 20, y);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    y += 7;

    const borrowerDetails = [
      ["Full Name:", name],
      ["Father's Name:", fatherName],
      ["Father's Mobile:", fatherMobile],
      ["Mobile Number:", mobile],
      ["Email Address:", email],
      ["Address:", address],
      ["PAN Number:", decryptedPan.toUpperCase()],
      ["Aadhaar Number:", `xxxx-xxxx-${decryptedAadhaar.slice(-4)}`],
    ];

    borrowerDetails.forEach(([label, value]) => {
      doc.setFont("Helvetica", "bold");
      doc.text(label!, 20, y);
      doc.setFont("Helvetica", "normal");
      if (label === "Address:") {
        const splitText = doc.splitTextToSize(value!, 120);
        doc.text(splitText, 75, y);
        y += splitText.length * 5;
      } else {
        doc.text(value!, 75, y);
        y += 6;
      }
    });

    y += 5;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TERMS AND CONDITIONS", 20, y);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    y += 6;

    const terms = [
      "1. The Borrower acknowledges receipt of the Principal Amount and agrees to repay it in full on or before the Due Date.",
      "2. The Borrower agrees to pay the stipulated Interest Amount. Late payments will incur additional penalties.",
      "3. All information provided by the Borrower is true, accurate, and complete. Any discrepancy constitutes default.",
      "4. This contract is digitally accepted and confirmed by the borrower checkbox validation.",
    ];

    terms.forEach((term) => {
      const splitTerm = doc.splitTextToSize(term, 170);
      doc.text(splitTerm, 20, y);
      y += splitTerm.length * 4.5;
    });

    y += 8;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("DIGITALLY ACCEPTED AND SIGNED VIA WEB FORM", 20, y);

    // Convert PDF to Buffer
    const pdfArrayBuffer = doc.output("arraybuffer");
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // Upload PDF to Supabase Storage
    const uploadId = Math.random().toString(36).substring(2, 15);
    const pdfPath = `borrowers/${uploadId}/loan_agreement_${loan.loanId}.pdf`;
    const adminClient = getSupabaseAdmin();
    const { error: pdfError } = await adminClient.storage
      .from("borrower-documents")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfError) {
      throw new Error(`PDF upload failed: ${pdfError.message}`);
    }

    const { data: { publicUrl: pdfUrl } } = adminClient.storage
      .from("borrower-documents")
      .getPublicUrl(pdfPath);

    // Update application details in DB
    await applicationRepository.update(app.applicationId, {
      status: "approved",
      borrowerId,
      loanId: loan.loanId,
      pdfUrl,
    });

    // Notify the admin by generating an audit log
    await auditLog("application_verified", "loan_application", app.applicationId, {
      code: app.applicationCode,
      borrowerId,
      loanId: loan.loanId,
      status: "Approved",
    });

    // Send confirmation SMS to Borrower
    const smsMessage = `Congratulations! Your Finexa loan application has been approved. Ref Code: ${app.applicationCode}. - Finexa`;
    let smsStatus: "sent" | "failed" = "sent";
    let smsError = "";
    try {
      const smsRes = await smsService.sendSMS(mobile, smsMessage);
      if (!smsRes.success) {
        smsStatus = "failed";
        smsError = smsRes.error || "SMS provider error";
      }
    } catch (e: any) {
      smsStatus = "failed";
      smsError = e.message || "Failed to trigger SMS service";
    }

    // Log SMS notification
    await db.insert(notificationsLogTable).values({
      loanId: loan.loanId,
      channel: "sms",
      type: "creation",
      status: smsStatus,
      errorMessage: smsError || null,
    });

    return { success: true, data: { success: true } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify application" };
  }
}

// Simple session helper since we are in "use server"
async function requireAuth() {
  const { requireAuth: auth } = await import("@/lib/auth");
  return await auth();
}
