import { format } from "date-fns";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";

export async function generateVehicleLoanAgreementPdf(loan: VehicleCollateralLoanData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - (margin * 2);
  const maxRightX = pageWidth - margin;

  // Executive Palette Tokens
  const COLOR_NAVY: [number, number, number] = [15, 23, 42];        // #0F172A Executive Navy
  const COLOR_GOLD: [number, number, number] = [184, 134, 11];      // #B8860B Finexa Gold
  const COLOR_LIGHT_GOLD: [number, number, number] = [212, 168, 67]; // #D4A843 Champagne Gold
  const COLOR_TEXT: [number, number, number] = [30, 41, 59];        // #1E293B Charcoal
  const COLOR_MUTED: [number, number, number] = [100, 116, 139];    // #64748B Slate Muted
  const COLOR_CARD_BG: [number, number, number] = [253, 252, 248];  // Warm Ivory
  const COLOR_CARD_BORDER: [number, number, number] = [226, 216, 191]; // Gold Border
  const COLOR_TAG_BG: [number, number, number] = [238, 242, 255];   // Light Indigo
  const COLOR_TAG_TEXT: [number, number, number] = [49, 46, 129];

  let y = 18;

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

  // Header & Legal Seal Banner
  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_NAVY);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "F");

  // Gold accent bar
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(margin, y + 23, contentWidth, 1.2, "F");

  // Logo / Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FINEXA DIGITAL FINANCE", margin + 6, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(212, 168, 67);
  doc.text("SECURED VEHICLE COLLATERAL LEDGER - LEGAL AGREEMENT", margin + 6, y + 15);

  // Application Code Box on Right
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(maxRightX - 52, y + 4, 46, 15, 1.5, 1.5, "F");
  doc.setTextColor(184, 134, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("AGREEMENT CODE", maxRightX - 49, y + 9);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(loan.applicationCode || "LN-2026-DIO35K", maxRightX - 49, y + 15);

  doc.restoreGraphicsState();
  y += 30;

  // Title of Legal Deed
  doc.setTextColor(...COLOR_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("VEHICLE COLLATERAL PLEDGE & EMERGENCY LOAN DEED", pageWidth / 2, y, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Executed on ${formatDateClean(loan.startDate)} at Visakhapatnam, Andhra Pradesh`, pageWidth / 2, y + 4.5, { align: "center" });

  y += 10;

  // Key Parties Card (Grid of Lender & Borrower & Owner)
  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_CARD_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, "FD");

  const colWidth = contentWidth / 3;

  // Lender Column
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_GOLD);
  doc.text("LENDER / FINANCIER", margin + 4, y + 6);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(9);
  doc.text(loan.lenderName || "Hari Kranth Sai", margin + 4, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(`Contact: ${loan.lenderContact || "6304228363"}`, margin + 4, y + 18);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Finexa Micro-Credit Division", margin + 4, y + 23);
  doc.text("Status: Verified Secured Lender", margin + 4, y + 28);

  // Borrower Column
  const col2X = margin + colWidth;
  doc.line(col2X, y + 3, col2X, y + 31);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_GOLD);
  doc.text("BORROWER / PLEDGOR", col2X + 4, y + 6);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(9);
  doc.text(loan.borrowerName || "Kuppili Abhilash", col2X + 4, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(`Contact: ${loan.borrowerContact || "9876543210"}`, col2X + 4, y + 18);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Purpose: Emergency / Hospital", col2X + 4, y + 23);
  doc.text("Status: Active Micro-Borrower", col2X + 4, y + 28);

  // Registered Owner Column
  const col3X = margin + (colWidth * 2);
  doc.line(col3X, y + 3, col3X, y + 31);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_GOLD);
  doc.text("REGISTERED VEHICLE OWNER", col3X + 4, y + 6);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(9);
  doc.text(loan.registeredOwner || "Golla Ramu", col3X + 4, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(`Vehicle: Honda Dio (AP39QY9367)`, col3X + 4, y + 18);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Role: Collateral Guarantor", col3X + 4, y + 23);
  doc.text("RTO Form 29 & 30: Surrendered", col3X + 4, y + 28);

  doc.restoreGraphicsState();
  y += 39;

  // Loan Financial Summary Banner
  doc.saveGraphicsState();
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

  const finCol = contentWidth / 4;
  
  // Principal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("PRINCIPAL AMOUNT", margin + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(formatMoney(loan.principalAmount), margin + 4, y + 13);

  // Total Payable
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("TOTAL AMOUNT PAYABLE", margin + finCol + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(184, 134, 11);
  doc.text(formatMoney(loan.totalAmountPayable), margin + finCol + 4, y + 13);

  // Loan Term & Duration
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("LOAN DURATION / TERM", margin + (finCol * 2) + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(loan.loanDuration || "1 Month", margin + (finCol * 2) + 4, y + 13);

  // Due Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("DUE & SETTLEMENT DATE", margin + (finCol * 3) + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text(formatDateClean(loan.dueDate), margin + (finCol * 3) + 4, y + 13);

  doc.restoreGraphicsState();
  y += 25;

  // Vehicle Collateral Specification Schedule
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("SCHEDULE A - PLEDGED VEHICLE & YARD CUSTODY SPECIFICATIONS", margin, y);
  y += 4;

  doc.saveGraphicsState();
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 30, 1.5, 1.5, "FD");

  const specRows = [
    [
      { label: "Make & Model:", val: loan.vehicleMakeModel || "Honda Dio (Drum Variant, BS-VI)" },
      { label: "Registration No:", val: loan.vehicleRegNumber || "AP39QY9367" },
    ],
    [
      { label: "Engine Number:", val: loan.engineNumber || "JF98EW0193408" },
      { label: "Chassis Number:", val: loan.chassisNumber || "ME4JF983GNW095191" },
    ],
    [
      { label: "Collateral Status:", val: "Physical Yard Bailment" },
      { label: "Storage Location:", val: loan.yardLocation || "Finexa Secured Compound / Yard Bay #3" },
    ],
  ];

  let specY = y + 6;
  specRows.forEach((row) => {
    // Left col
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(row[0].label, margin + 4, specY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(row[0].val, margin + 34, specY);

    // Right col
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_MUTED);
    doc.text(row[1].label, margin + 90, specY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(row[1].val, margin + 124, specY);

    specY += 8;
  });

  doc.restoreGraphicsState();
  y += 35;

  // Documents Handed Over & Custody Checklist
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("SCHEDULE B - LEGAL DOCUMENTS RETAINED IN SAFE CUSTODY", margin, y);
  y += 4;

  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_CARD_BORDER);
  doc.roundedRect(margin, y, contentWidth, 20, 1.5, 1.5, "FD");

  const docs = loan.documentsCollected || [
    "Original Smart Card RC",
    "Signed RTO Form 29 & Form 30",
    "Signed Security Cheque(s)",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT);
  
  docs.forEach((docItem, idx) => {
    const docX = margin + 4 + (idx % 2 === 0 ? 0 : 88);
    const docItemY = y + 6 + (Math.floor(idx / 2) * 6.5);
    doc.setFillColor(34, 197, 94);
    doc.circle(docX + 1.5, docItemY - 1.2, 1.2, "F");
    doc.text(docItem, docX + 5, docItemY);
  });

  doc.restoreGraphicsState();
  y += 25;

  // Covenants & Default Clause
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("LEGAL COVENANTS, LIQUIDATION & POWER OF ATTORNEY CLAUSES", margin, y);
  y += 4;

  const clauses = [
    "1. PLEDGE & BAILMENT: The Borrower Kuppili Abhilash and Registered Owner Golla Ramu acknowledge delivering physical possession of Honda Dio (AP39QY9367) into the secure yard custody of Hari Kranth Sai as sole security against the principal loan of Rs. 28,000 for hospital/emergency purposes.",
    "2. REPAYMENT COVENANT: The Borrower irrevocably covenants to pay the total agreed sum of Rs. 35,000 in a single settlement on or before 23rd October 2026. Upon receipt of full payment, vehicle and documents will be released within 24 hours.",
    "3. DEFAULT & SALE AUTHORIZATION: In the event of failure to pay Rs. 35,000 by 23rd October 2026, the Lender Hari Kranth Sai is unconditionally authorized to invoke signed RTO Forms 29/30, encash security cheques, or sell/liquidate the vehicle to recover all dues without further judicial decree.",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  clauses.forEach((c) => {
    const lines = doc.splitTextToSize(c, contentWidth - 4);
    doc.text(lines, margin + 2, y);
    y += (lines.length * 3.4) + 1.5;
  });

  y += 4;

  // Signatures Section
  doc.saveGraphicsState();
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 26, 1.5, 1.5, "FD");

  const sigW = contentWidth / 3;

  // Lender Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("LENDER SIGNATURE", margin + 4, y + 5);
  doc.line(margin + 4, y + 17, margin + sigW - 4, y + 17);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(8);
  doc.text(loan.lenderName || "Hari Kranth Sai", margin + 4, y + 21);
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Authorized Signature & Stamp", margin + 4, y + 24.5);

  // Borrower Box
  const sig2X = margin + sigW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("BORROWER SIGNATURE", sig2X + 4, y + 5);
  doc.line(sig2X + 4, y + 17, sig2X + sigW - 4, y + 17);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(8);
  doc.text(loan.borrowerName || "Kuppili Abhilash", sig2X + 4, y + 21);
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Borrower / Pledgor", sig2X + 4, y + 24.5);

  // Registered Owner Box
  const sig3X = margin + (sigW * 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("REGISTERED OWNER SIGNATURE", sig3X + 4, y + 5);
  doc.line(sig3X + 4, y + 17, sig3X + sigW - 4, y + 17);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(8);
  doc.text(loan.registeredOwner || "Golla Ramu", sig3X + 4, y + 21);
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Vehicle Owner / Guarantor", sig3X + 4, y + 24.5);

  doc.restoreGraphicsState();

  // Footer note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("FINEXA DIGITAL LOAN SYSTEM - AUDIT VERIFIED - SECURED VEHICLE CUSTODY", pageWidth / 2, pageHeight - 6, { align: "center" });

  // Save PDF
  const filename = `FINEXA_Vehicle_Agreement_${loan.applicationCode || "LN-2026-DIO35K"}_${loan.vehicleRegNumber || "AP39QY9367"}.pdf`;
  doc.save(filename);
}
