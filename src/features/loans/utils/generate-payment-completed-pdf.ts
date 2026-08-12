import { jsPDF } from "jspdf";
import { format } from "date-fns";

export type PaymentCompletedResultPayload = {
  documentId: string;
  transactionId: string;
  paymentDate: string;
  paymentAmount: number;
  paymentType: string;
  notes?: string | null;

  loanId: string;
  borrowerName: string;
  borrowerMobile: string;
  fatherName?: string;
  fatherMobile?: string;
  email?: string;
  address?: string;
  panDecrypted?: string;
  aadhaarDecrypted?: string;
  locationUrl?: string;

  dateGiven: string;
  dueDate: string;
  principal: number;
  interestRate: number;
  interestType: string;
  monthlyInterestAmount: number;

  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;

  previousOutstanding: number;
  remainingOutstanding: number;
  totalPayableAfterPayment: number;
  totalAmountPaidToDate: number;
  totalInterestAccrued: number;
  totalPenaltyAccrued: number;

  loanStatus: string;
  isFullyCleared: boolean; // True ONLY if remainingOutstanding <= 0 and totalPayable <= 0

  paymentsHistory: Array<{
    paymentId: string;
    paymentDate: string;
    amount: number | string;
    paymentType: string;
    notes?: string | null;
  }>;
};

export function generatePaymentCompletedPdf(data: PaymentCompletedResultPayload): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // Executive Page Layout Margins (A4)
  const margin = 18;        // Left & Right 18mm
  const topMargin = 25;     // Top 25mm
  const bottomMargin = 20;  // Bottom 20mm
  const contentWidth = 174; // 210 - 36
  const maxRightX = pageWidth - margin; // 192mm
  const sectionGap = 7;     // 7mm space between section cards

  // Executive Palette Tokens
  const COLOR_NAVY = [15, 20, 30];          // Deep Executive Navy (#0F141E)
  const COLOR_GOLD = [184, 134, 11];        // FINEXA Gold (#B8860B)
  const COLOR_LIGHT_GOLD = [212, 168, 67];   // Champagne Gold (#D4A843)
  const COLOR_TEXT = [35, 40, 48];           // Dark Charcoal Body Text
  const COLOR_MUTED = [100, 110, 125];       // Muted Label Text
  const COLOR_CARD_BG = [252, 251, 244];     // Warm Ivory Fill (#FCFAF4)
  const COLOR_CARD_BORDER = [226, 216, 191]; // Soft Gold Border (#E2D8BF)

  const COLOR_RED_BG = [253, 242, 242];
  const COLOR_RED_BORDER = [248, 180, 180];
  const COLOR_RED_TEXT = [155, 28, 28];

  const COLOR_AMBER_BG = [254, 252, 232];
  const COLOR_AMBER_BORDER = [253, 224, 71];
  const COLOR_AMBER_TEXT = [113, 63, 18];

  const COLOR_GREEN_BG = [232, 245, 233];
  const COLOR_GREEN_BORDER = [160, 212, 164];
  const COLOR_GREEN_TEXT = [14, 94, 46];

  let y = topMargin;

  // Indian Currency Formatter (e.g. Rs. 1,25,000.00)
  function formatMoney(amount: number | string, includeDecimals = true): string {
    const num = Number(amount || 0);
    if (isNaN(num)) return "Rs. 0.00";
    if (includeDecimals) {
      return `Rs. ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `Rs. ${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }

  // Header & Footer Renderer Across All Pages
  function renderHeaderFooter(pageNum: number, totalPages: number) {
    doc.saveGraphicsState();

    // Top Header Bar (16mm Height)
    doc.setFillColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.rect(0, 0, pageWidth, 16, "F");

    // Accent Gold Line (1.5mm)
    doc.setFillColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    doc.rect(0, 16, pageWidth, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLOR_LIGHT_GOLD[0], COLOR_LIGHT_GOLD[1], COLOR_LIGHT_GOLD[2]);
    doc.text("FINEXA", margin, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(200, 205, 215);
    doc.text("SMART LOAN MANAGEMENT SYSTEM  •  PAYMENT COMPLETED STATEMENT", margin + 18, 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_LIGHT_GOLD[0], COLOR_LIGHT_GOLD[1], COLOR_LIGHT_GOLD[2]);
    doc.text(`DOC ID: ${data.documentId}`, maxRightX, 11, { align: "right" });

    // Footer Line
    doc.setDrawColor(215, 215, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, maxRightX, pageHeight - 12);

    // Footer Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text("FINEXA — Smart Loan Management System | Payment Completion Receipt & Statement", margin, pageHeight - 7);
    doc.text(`Doc ID: ${data.documentId} | Page ${pageNum} of ${totalPages}`, maxRightX, pageHeight - 7, { align: "right" });

    doc.restoreGraphicsState();
  }

  // Content-Aware Page Break Intelligence
  function checkPageBreak(neededHeight: number): boolean {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = topMargin + 2;
      return true;
    }
    return false;
  }

  function renderCardTitle(titleStr: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    doc.text(titleStr.toUpperCase(), margin + 5, y + 6);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 1. DOCUMENT TITLE BANNER & STATUS BADGE
  // ═════════════════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("PAYMENT COMPLETED STATEMENT", margin, y + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text(`Payment Date: ${data.paymentDate}`, maxRightX, y + 3, { align: "right" });

  y += 7;
  doc.setDrawColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, maxRightX, y);
  y += 5;

  // Status Banner Box (Closed vs Active)
  let bannerBg = COLOR_GREEN_BG;
  let bannerBorder = COLOR_GREEN_BORDER;
  let bannerText = COLOR_GREEN_TEXT;
  let bannerTitle = "PAYMENT SUCCESSFUL — LOAN ACCOUNT FULLY CLEARED & CLOSED";
  let bannerSub = `Full settlement of ${formatMoney(data.paymentAmount, true)} received on ${data.paymentDate}. Zero outstanding balance remains.`;

  if (!data.isFullyCleared) {
    bannerBg = COLOR_AMBER_BG;
    bannerBorder = COLOR_AMBER_BORDER;
    bannerText = COLOR_AMBER_TEXT;
    bannerTitle = "PAYMENT SUCCESSFUL — LOAN ACCOUNT REMAINS ACTIVE";
    bannerSub = `Payment of ${formatMoney(data.paymentAmount, true)} recorded on ${data.paymentDate}. Remaining balance: ${formatMoney(data.remainingOutstanding, true)}.`;
  }

  doc.setFillColor(bannerBg[0], bannerBg[1], bannerBg[2]);
  doc.setDrawColor(bannerBorder[0], bannerBorder[1], bannerBorder[2]);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(bannerText[0], bannerText[1], bannerText[2]);
  doc.text(bannerTitle, margin + 5, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(bannerSub, margin + 5, y + 10);

  y += 14 + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // (01) BORROWER INFORMATION CARD
  // ═════════════════════════════════════════════════════════════════════════
  const colW = (contentWidth - 14) / 2; // 80mm per column
  const leftColX = margin + 5;
  const rightColX = margin + colW + 9;

  const panStr = data.panDecrypted ? data.panDecrypted : "Not Provided";
  const aadhaarStr = data.aadhaarDecrypted ? data.aadhaarDecrypted : "Not Provided";

  const wrappedPan = doc.splitTextToSize(panStr, colW - 4);
  const wrappedAadhaar = doc.splitTextToSize(aadhaarStr, colW - 4);

  const kycHeight = Math.max(wrappedPan.length, wrappedAadhaar.length) * 4;
  const card01Height = 11 + 22 + kycHeight + 6;

  checkPageBreak(card01Height);

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, card01Height, 2, 2, "FD");

  renderCardTitle("(01) BORROWER INFORMATION");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  let bRowY = y + 14;

  // Left Column
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("CUSTOMER NAME", leftColX, bRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text(data.borrowerName, leftColX, bRowY + 4.5);

  bRowY += 10.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("MOBILE NUMBER", leftColX, bRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(data.borrowerMobile, leftColX, bRowY + 4.5);

  bRowY += 10.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("EMAIL ADDRESS", leftColX, bRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(data.email || "N/A", leftColX, bRowY + 4.5);

  // Right Column
  let rRowY = y + 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("PAN NUMBER", rightColX, rRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(wrappedPan, rightColX, rRowY + 4.5);

  rRowY += 10.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("AADHAAR NUMBER", rightColX, rRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(wrappedAadhaar, rightColX, rRowY + 4.5);

  y += card01Height + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // (02) LOAN PORTFOLIO SUMMARY
  // ═════════════════════════════════════════════════════════════════════════
  const gridCardW = (contentWidth - 14) / 2; // 80mm each

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const loanIdWrapped = doc.splitTextToSize(data.loanId.toUpperCase(), gridCardW - 8);
  const loanIdBoxH = Math.max(16, 11 + loanIdWrapped.length * 3.8);

  const card02Height = 11 + loanIdBoxH + 3 + 16 + 3 + 16 + 8;

  checkPageBreak(card02Height);

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, card02Height, 2, 2, "FD");

  renderCardTitle("(02) LOAN PORTFOLIO SUMMARY");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  const gridStartY = y + 12;

  const summaryItems = [
    { label: "LOAN ID", val: loanIdWrapped, isBold: true, customH: loanIdBoxH },
    { label: "LOAN ISSUE DATE", val: data.dateGiven || "N/A", customH: loanIdBoxH },
    { label: "CURRENT DUE DATE", val: data.dueDate || "N/A", isGold: true, customH: 16 },
    { label: "PAYMENT DATE", val: data.paymentDate, customH: 16 },
    { label: "ORIGINAL PRINCIPAL", val: formatMoney(data.principal, false), isBold: true, customH: 16 },
    { label: "INTEREST RATE BASIS", val: `Rs. ${data.interestRate} / Rs. 1,000 / month`, customH: 16 },
  ];

  summaryItems.forEach((sc, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);

    const cx = margin + 5 + colIdx * (gridCardW + 4);

    let cy = gridStartY;
    if (rowIdx === 1) cy = gridStartY + loanIdBoxH + 3;
    if (rowIdx === 2) cy = gridStartY + loanIdBoxH + 3 + 16 + 3;

    const currentBoxH = sc.customH || 16;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(230, 224, 205);
    doc.roundedRect(cx, cy, gridCardW, currentBoxH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(sc.label, cx + 4, cy + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    if (sc.isGold) {
      doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    } else {
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    }
    doc.text(sc.val, cx + 4, cy + 11);
  });

  y += card02Height + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // (03) RECENT PAYMENT COMPLETION DETAILS
  // ═════════════════════════════════════════════════════════════════════════
  const card03Height = 66;

  checkPageBreak(card03Height);

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, card03Height, 2, 2, "FD");

  renderCardTitle("(03) PAYMENT COMPLETION DETAILS");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  let pY = y + 14;

  // Banner Box for PAYMENT AMOUNT RECEIVED
  doc.setFillColor(232, 245, 233);
  doc.setDrawColor(160, 212, 164);
  doc.roundedRect(margin + 5, pY, contentWidth - 10, 15, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(14, 94, 46);
  doc.text("PAYMENT AMOUNT RECORDED", margin + 10, pY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(14, 94, 46);
  doc.text(formatMoney(data.paymentAmount, true), maxRightX - 10, pY + 10.5, { align: "right" });

  pY += 20;

  const payItems = [
    { label: "TRANSACTION REFERENCE / ID", val: data.transactionId.toUpperCase() },
    { label: "PAYMENT DATE", val: data.paymentDate },
    { label: "PAYMENT TYPE", val: data.paymentType.toUpperCase(), isBold: true },
    { label: "PREVIOUS OUTSTANDING", val: formatMoney(data.previousOutstanding, true) },
    { label: "REMAINING OUTSTANDING BALANCE", val: formatMoney(data.remainingOutstanding, true), isGold: true },
  ];

  payItems.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(item.label, margin + 8, pY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    if (item.isGold) {
      doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    } else {
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    }
    doc.text(item.val, maxRightX - 8, pY, { align: "right" });

    pY += 8;
  });

  y += card03Height + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 2 STARTS HERE — (04) ITEMIZED CALCULATION BREAKDOWN
  // ═════════════════════════════════════════════════════════════════════════
  const card04Height = 56;

  checkPageBreak(card04Height);

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, card04Height, 2, 2, "FD");

  renderCardTitle("(04) PAYMENT CALCULATION BREAKDOWN");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  // Table Header Bar
  const tblY = y + 13;
  doc.setFillColor(240, 234, 215);
  doc.rect(margin + 5, tblY, contentWidth - 10, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("LINE ITEM DESCRIPTION", margin + 8, tblY + 4);
  doc.text("CALCULATION BASIS", margin + 65, tblY + 4);
  doc.text("AMOUNT", maxRightX - 8, tblY + 4, { align: "right" });

  const accountingRows = [
    { desc: "Loan Principal", basis: "Original Disbursed Principal", amt: `+ ${formatMoney(data.principal, true)}` },
    { desc: "Accrued Interest", basis: `Rs. ${data.interestRate} / Rs. 1,000 / month`, amt: `+ ${formatMoney(data.totalInterestAccrued, true)}` },
    { desc: "Accrued Penalty", basis: data.totalPenaltyAccrued > 0 ? `Applicable Penalty Dues` : "No Penalty (On Time)", amt: `+ ${formatMoney(data.totalPenaltyAccrued, true)}` },
    { desc: "Payments Credited", basis: `Total Payments Received to Date`, amt: `- ${formatMoney(data.totalAmountPaidToDate, true)}` },
  ];

  accountingRows.forEach((row, idx) => {
    const rowTop = tblY + 7 + idx * 6;
    if (idx % 2 === 1) {
      doc.setFillColor(250, 248, 242);
      doc.rect(margin + 5, rowTop - 1, contentWidth - 10, 6, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
    doc.text(row.desc, margin + 8, rowTop + 3.2);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(row.basis, margin + 65, rowTop + 3.2);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.text(row.amt, maxRightX - 8, rowTop + 3.2, { align: "right" });
  });

  // Table Bottom Summary Line
  const totalLineY = tblY + 32;
  doc.setDrawColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 5, totalLineY, maxRightX - 5, totalLineY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("CURRENT OUTSTANDING BALANCE", margin + 8, totalLineY + 5.5);
  doc.text(formatMoney(data.remainingOutstanding, true), maxRightX - 8, totalLineY + 5.5, { align: "right" });

  y += card04Height + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // (05) REPAYMENT DETAILS & HISTORY (INDIVIDUAL TRANSACTION CARDS)
  // ═════════════════════════════════════════════════════════════════════════
  const hasHistory = data.paymentsHistory.length > 0;

  if (hasHistory) {
    data.paymentsHistory.forEach((p, pIdx) => {
      const remarkText = p.notes || "Payment credit recorded for loan portfolio.";
      const wrappedRemark = doc.splitTextToSize(remarkText, contentWidth - 14);
      const txCardH = Math.max(48, 40 + wrappedRemark.length * 4);

      checkPageBreak(txCardH);

      doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.roundedRect(margin, y, contentWidth, txCardH, 2, 2, "FD");

      renderCardTitle(`(05) REPAYMENT RECORD #${String(pIdx + 1).padStart(2, "0")}`);
      doc.setDrawColor(228, 220, 195);
      doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

      let hY = y + 14;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("PAYMENT DATE", margin + 7, hY);
      doc.text("TRANSACTION REFERENCE", margin + 70, hY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
      doc.text(p.paymentDate, margin + 7, hY + 4.5);
      doc.text(p.paymentId.toUpperCase(), margin + 70, hY + 4.5);

      hY += 11;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("TYPE / REMARK", margin + 7, hY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
      doc.text(wrappedRemark, margin + 7, hY + 4.5);

      hY += 6 + wrappedRemark.length * 4;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("STATUS", margin + 7, hY);
      doc.text("AMOUNT CREDITED", margin + 70, hY);

      doc.setFillColor(232, 245, 233);
      doc.setDrawColor(160, 212, 164);
      doc.roundedRect(margin + 7, hY + 2, 22, 5, 1, 1, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(14, 94, 46);
      doc.text("RECEIVED", margin + 9.5, hY + 5.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
      doc.text(formatMoney(p.amount, true), margin + 70, hY + 6);

      y += txCardH + sectionGap;
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // (06) OFFICIAL FINEXA STAMP — FULL PAYMENT ONLY (EXCLUSIVELY WHEN OUTSTANDING = 0)
  // ═════════════════════════════════════════════════════════════════════════
  if (data.isFullyCleared) {
    checkPageBreak(28);

    const stampW = 110;
    const stampH = 22;
    const stampX = (pageWidth - stampW) / 2; // Center Aligned
    const stampY = y;

    // Outer Emerald Green Border
    doc.setDrawColor(14, 94, 46);
    doc.setLineWidth(0.8);
    doc.roundedRect(stampX, stampY, stampW, stampH, 2, 2, "D");

    // Inner Green Border
    doc.setLineWidth(0.3);
    doc.roundedRect(stampX + 0.8, stampY + 0.8, stampW - 1.6, stampH - 1.6, 1.5, 1.5, "D");

    // Green Checkmark & Heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(14, 94, 46);
    doc.text("✓ ALL AMOUNT CLEARED", pageWidth / 2, stampY + 8, { align: "center" });

    // Red Dotted Separator Line
    doc.setDrawColor(180, 40, 40);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(stampX + 12, stampY + 11.5, stampX + stampW - 12, stampY + 11.5);
    doc.setLineDashPattern([], 0);

    // Red Subtitle: FINEXA • DATE: AUG 11TH • TUESDAY
    const dateObj = data.paymentDate ? new Date(data.paymentDate) : new Date();
    const stampDateStr = format(dateObj, "MMM dd'TH' • EEEE").toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(180, 30, 30);
    doc.text(`FINEXA • DATE: ${stampDateStr}`, pageWidth / 2, stampY + 17, { align: "center" });

    y += stampH + sectionGap + 2;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // (07) THANK YOU & ENTERPRISE CLOSING
  // ═════════════════════════════════════════════════════════════════════════
  checkPageBreak(22);
  doc.setFillColor(250, 248, 242);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("Thank You!", pageWidth / 2, y + 7, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("FINEXA — Smart Loan Management System", pageWidth / 2, y + 12.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("We appreciate your payment settlement and cooperation with FINEXA.", pageWidth / 2, y + 16.5, { align: "center" });

  // Render Header & Footer Across All Pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderHeaderFooter(i, totalPages);
  }

  // Trigger File Download
  const cleanBorrower = data.borrowerName.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `FINEXA_Payment_Completed_${cleanBorrower}_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;
  doc.save(filename);
}
