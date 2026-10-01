import { format } from "date-fns";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";
import { VehicleApplicationPdfPayload } from "../types/vehicle-loan-pdf.types";

export async function generateVehicleApplicationPdf(
  payload: VehicleApplicationPdfPayload | VehicleCollateralLoanData
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const loan: VehicleCollateralLoanData = "loan" in payload ? payload.loan : payload;
  const fatherName = "fatherName" in payload ? payload.fatherName : "Kuppili Satyanarayana";
  const fatherContact = "fatherContact" in payload ? payload.fatherContact : "9440123456";
  const aadhaarNumber = "aadhaarNumber" in payload ? payload.aadhaarNumber : "7845 9210 3341";
  const panNumber = "panNumber" in payload ? payload.panNumber : "ABCPA1234K";
  const hospitalNote = "hospitalPurposeNote" in payload 
    ? payload.hospitalPurposeNote 
    : "Emergency Hospitalization & Medical Treatment at Apollo Hospital Visakhapatnam";
  const signatureName = "signatureName" in payload ? payload.signatureName : loan.borrowerName;
  const submissionDate = "submissionDate" in payload ? payload.submissionDate : loan.startDate;

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - (margin * 2);
  const maxRightX = pageWidth - margin;

  const COLOR_NAVY: [number, number, number] = [15, 23, 42];        // #0F172A
  const COLOR_GOLD: [number, number, number] = [184, 134, 11];      // #B8860B
  const COLOR_TEXT: [number, number, number] = [30, 41, 59];        // #1E293B
  const COLOR_MUTED: [number, number, number] = [100, 116, 139];    // #64748B
  const COLOR_CARD_BG: [number, number, number] = [248, 250, 252];  // Slate 50
  const COLOR_BORDER: [number, number, number] = [226, 232, 240];   // Slate 200

  let y = 16;

  function formatMoney(amount: number | string): string {
    const num = Number(amount || 0);
    return `Rs. ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDateClean(dateStr?: string): string {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMMM yyyy");
    } catch {
      return dateStr;
    }
  }

  // Header Banner
  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_NAVY);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "F");

  // Gold accent line
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(margin, y + 23, contentWidth, 1.2, "F");

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("FINEXA DIGITAL FINANCE", margin + 6, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(212, 168, 67);
  doc.text("OFFICIAL BORROWER APPLICATION FORM - VEHICLE COLLATERAL DIVISION", margin + 6, y + 15);

  // Application Code Box
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(maxRightX - 52, y + 4, 46, 15, 1.5, 1.5, "F");
  doc.setTextColor(184, 134, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("APPLICATION NO.", maxRightX - 49, y + 9);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(loan.applicationCode || "LN-2026-DIO35K", maxRightX - 49, y + 15);

  doc.restoreGraphicsState();
  y += 30;

  // Title of Document
  doc.setTextColor(...COLOR_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("EMERGENCY VEHICLE-BACKED MICRO-LOAN APPLICATION", pageWidth / 2, y, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Submitted & Verified on: ${formatDateClean(submissionDate)} | Branch: Visakhapatnam, A.P.`, pageWidth / 2, y + 4.5, { align: "center" });

  y += 10;

  // Section 1: Financial & Facility Terms Matrix
  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, "FD");

  const finCol = contentWidth / 4;

  // Principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("PRINCIPAL DISBURSED", margin + 4, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(formatMoney(loan.principalAmount), margin + 4, y + 14);

  // Repayment Payable
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("TOTAL REPAYABLE", margin + finCol + 4, y + 6);
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_GOLD);
  doc.text(formatMoney(loan.totalAmountPayable), margin + finCol + 4, y + 14);

  // Duration
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("FACILITY DURATION", margin + (finCol * 2) + 4, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(loan.loanDuration || "1 Month", margin + (finCol * 2) + 4, y + 14);

  // Due Date
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("SETTLEMENT DUE DATE", margin + (finCol * 3) + 4, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text(formatDateClean(loan.dueDate), margin + (finCol * 3) + 4, y + 14);

  doc.restoreGraphicsState();
  y += 27;

  // Section 2: Borrower Identity & KYC Data
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("SECTION 1 — APPLICANT PERSONAL & KYC PARTICULARS", margin, y);
  y += 4;

  doc.saveGraphicsState();
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, y, contentWidth, 36, 1.5, 1.5, "FD");

  const kycRows = [
    [
      { label: "Full Legal Name:", val: loan.borrowerName || "Kuppili Abhilash" },
      { label: "Mobile (WhatsApp):", val: loan.borrowerContact || "9876543210" },
    ],
    [
      { label: "Father's Name:", val: fatherName },
      { label: "Father's Contact:", val: fatherContact },
    ],
    [
      { label: "Aadhaar Number:", val: aadhaarNumber },
      { label: "PAN Card Number:", val: panNumber },
    ],
    [
      { label: "Purpose Category:", val: "Hospital / Emergency Medical" },
      { label: "Residential Location:", val: "Gajuwaka, Visakhapatnam - 530026" },
    ],
  ];

  let kycY = y + 5.5;
  kycRows.forEach((row) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(row[0].label, margin + 4, kycY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(row[0].val || "-", margin + 35, kycY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_MUTED);
    doc.text(row[1].label, margin + 92, kycY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(row[1].val || "-", margin + 128, kycY);

    kycY += 7.5;
  });

  doc.restoreGraphicsState();
  y += 41;

  // Hospital Note Callout
  doc.saveGraphicsState();
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text("EMERGENCY MEDICAL JUSTIFICATION & HOSPITAL PURPOSE NOTE:", margin + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 53, 15);
  doc.text(hospitalNote || "Emergency Medical Assistance", margin + 4, y + 10);
  doc.restoreGraphicsState();
  y += 18;

  // Section 3: Pledged Vehicle Identification
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("SECTION 2 — PLEDGED VEHICLE & YARD CUSTODY SCHEDULE", margin, y);
  y += 4;

  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, y, contentWidth, 32, 1.5, 1.5, "FD");

  const vehRows = [
    [
      { label: "Make & Model:", val: loan.vehicleMakeModel || "Honda Dio (Drum Variant, BS-VI)" },
      { label: "Registration No:", val: loan.vehicleRegNumber || "AP39QY9367" },
    ],
    [
      { label: "Engine Number:", val: loan.engineNumber || "JF98EW0193408" },
      { label: "Chassis Number:", val: loan.chassisNumber || "ME4JF983GNW095191" },
    ],
    [
      { label: "Registered Owner:", val: loan.registeredOwner || "Golla Ramu" },
      { label: "Owner Relationship:", val: "Guarantor / Consenting Owner" },
    ],
    [
      { label: "Yard Location:", val: loan.yardLocation || "Finexa Secured Compound / Yard Bay #3" },
      { label: "Possession Status:", val: "Physical Yard Bailment" },
    ],
  ];

  let vehY = y + 5.5;
  vehRows.forEach((row) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(row[0].label, margin + 4, vehY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(row[0].val || "-", margin + 35, vehY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_MUTED);
    doc.text(row[1].label, margin + 92, vehY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(row[1].val || "-", margin + 128, vehY);

    vehY += 6.5;
  });

  doc.restoreGraphicsState();
  y += 37;

  // Section 4: Document Surrender Inventory
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("SECTION 3 — ORIGINAL STATUTORY DOCUMENTS SURRENDERED & DEPOSITED", margin, y);
  y += 4;

  doc.saveGraphicsState();
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, "FD");

  const docList = loan.documentsCollected || [
    "Original Smart Card RC",
    "Signed RTO Form 29 & Form 30",
    "Signed Security Cheque(s)",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT);
  docList.forEach((d, idx) => {
    const dX = margin + 4 + (idx % 2 === 0 ? 0 : 88);
    const dY = y + 6 + (Math.floor(idx / 2) * 6);
    doc.setFillColor(34, 197, 94);
    doc.circle(dX + 1.5, dY - 1.2, 1.2, "F");
    doc.text(d, dX + 5, dY);
  });

  doc.restoreGraphicsState();
  y += 23;

  // Section 5: Borrower Declaration & E-Sign
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("SECTION 4 — APPLICANT DECLARATION, UNDERTAKING & E-SIGNATURE", margin, y);
  y += 4;

  const declText = 
    "I, " + (loan.borrowerName || "Kuppili Abhilash") + ", solemnly declare that all statements made herein are true and accurate. " +
    "I confirm handing over physical possession of Honda Dio (AP39QY9367) to Hari Kranth Sai at Finexa Yard. " +
    "I unconditionally undertake to repay Rs. 35,000 on or before 23rd October 2026. In default thereof, I authorize the Lender to liquidate " +
    "the vehicle under signed RTO Forms 29 & 30 without further judicial intervention.";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  const declLines = doc.splitTextToSize(declText, contentWidth - 4);
  doc.text(declLines, margin + 2, y);
  y += (declLines.length * 3.4) + 3;

  // Signature Boxes
  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, "FD");

  const sigColW = contentWidth / 2;

  // Borrower Sig Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("APPLICANT / BORROWER DIGITAL SIGNATURE", margin + 4, y + 5);
  doc.line(margin + 4, y + 16, margin + sigColW - 10, y + 16);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(8.5);
  doc.text(signatureName || loan.borrowerName || "Applicant", margin + 4, y + 20);
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`E-Signed Online | IP Verified | Date: ${formatDateClean(submissionDate)}`, margin + 4, y + 23);

  // Lender Verification Box
  const col2SigX = margin + sigColW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("LENDER CUSTODY VERIFICATION & APPROVAL", col2SigX + 4, y + 5);
  doc.line(col2SigX + 4, y + 16, col2SigX + sigColW - 10, y + 16);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(8.5);
  doc.text(loan.lenderName || "Hari Kranth Sai", col2SigX + 4, y + 20);
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Verified & Approved | Yard Officer Stamp | Contact: ${loan.lenderContact || "6304228363"}`, col2SigX + 4, y + 23);

  doc.restoreGraphicsState();

  // Footer Note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("FINEXA DIGITAL LOAN SYSTEM - SECURED VEHICLE COLLATERAL APPLICATION - PAGE 1 OF 1", pageWidth / 2, pageHeight - 6, { align: "center" });

  const filename = `FINEXA_Borrower_Application_${loan.applicationCode || "LN-2026-DIO35K"}_${loan.borrowerName.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
