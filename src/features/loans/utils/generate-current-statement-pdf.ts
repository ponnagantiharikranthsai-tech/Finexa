import { jsPDF } from "jspdf";
import { format } from "date-fns";

export type CurrentStatementPayload = {
  documentId: string;
  statementDate: string;
  loanId: string;
  borrowerName: string;
  mobile: string;
  email?: string;
  panDecrypted?: string;
  aadhaarDecrypted?: string;
  locationUrl?: string;
  fatherName?: string;
  address?: string;

  principal: number;
  interestRate: number;
  interestType: "monthly" | "daily";
  dateGiven: string;
  dueDate: string;
  status: string;
  penaltyRate?: number;
  manualPenaltyAmount?: number;

  monthlyInterestAmount: number;
  totalInterest: number;
  accruedPenalty: number;
  isPenaltyActive: boolean;
  overdueDays: number;
  daysRemaining: number;
  isOverdue: boolean;

  totalPayments: number;
  outstandingBalance: number;
  totalPayable: number;

  payments: Array<{
    paymentId: string;
    amount: number | string;
    paymentDate: string;
    notes?: string | null;
  }>;
  cycles: Array<{
    cycleId: string;
    startDate?: string;
    originalDueDate?: string;
    previousDueDate?: string;
    newDueDate?: string;
    interestPaid?: number | string | null;
    createdAt: string | Date;
  }>;
  notes?: string;
};

export function generateCurrentStatementPdf(data: CurrentStatementPayload): void {
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
    doc.text("SMART LOAN MANAGEMENT SYSTEM  •  CURRENT LOAN STATEMENT", margin + 18, 11);

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
    doc.text("FINEXA — Smart Loan Management System | Official System-Generated Current Statement", margin, pageHeight - 7);
    doc.text(`Doc ID: ${data.documentId} | Page ${pageNum} of ${totalPages}`, maxRightX, pageHeight - 7, { align: "right" });

    doc.restoreGraphicsState();
  }

  // Content-Driven Page Break Intelligence
  function checkPageBreak(neededHeight: number): boolean {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = topMargin + 2;
      return true;
    }
    return false;
  }

  function getAvailableSpace(): number {
    return (pageHeight - bottomMargin) - y;
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
  doc.text("CURRENT LOAN STATEMENT", margin, y + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text(`Statement Date: ${data.statementDate}`, maxRightX, y + 3, { align: "right" });

  y += 7;
  doc.setDrawColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, maxRightX, y);
  y += 6;

  // Status Banner Box
  let bannerBg = COLOR_GREEN_BG;
  let bannerBorder = COLOR_GREEN_BORDER;
  let bannerText = COLOR_GREEN_TEXT;
  let bannerTitle = "LOAN STATUS: ACTIVE — PAYMENT ON TRACK";
  let bannerSub = `Payment is due on or before ${data.dueDate}. (${data.daysRemaining} Days Remaining). No overdue penalties accrued.`;

  if (data.isOverdue) {
    bannerBg = COLOR_RED_BG;
    bannerBorder = COLOR_RED_BORDER;
    bannerText = COLOR_RED_TEXT;
    bannerTitle = "LOAN STATUS: PAYMENT OVERDUE";
    bannerSub = `Overdue by ${data.overdueDays} Days (Due Date: ${data.dueDate}). Overdue penalty is currently active.`;
  } else if (data.daysRemaining <= 7 && data.daysRemaining >= 0) {
    bannerBg = COLOR_AMBER_BG;
    bannerBorder = COLOR_AMBER_BORDER;
    bannerText = COLOR_AMBER_TEXT;
    bannerTitle = "LOAN STATUS: PAYMENT DUE SOON";
    bannerSub = `Payment is due in ${data.daysRemaining} Days (Due Date: ${data.dueDate}). Please ensure timely settlement.`;
  }

  doc.setFillColor(bannerBg[0], bannerBg[1], bannerBg[2]);
  doc.setDrawColor(bannerBorder[0], bannerBorder[1], bannerBorder[2]);
  doc.roundedRect(margin, y, contentWidth, 15, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(bannerText[0], bannerText[1], bannerText[2]);
  doc.text(bannerTitle, margin + 5, y + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(bannerSub, margin + 5, y + 11);

  y += 20;

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

  const cardBodyH = 44;

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, cardBodyH, 2, 2, "FD");

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
  doc.text(data.mobile, leftColX, bRowY + 4.5);

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

  y += cardBodyH + 5;

  // ═════════════════════════════════════════════════════════════════════════
  // (02) LOAN PORTFOLIO SUMMARY (FIT EFFICIENTLY ON PAGE 1)
  // ═════════════════════════════════════════════════════════════════════════
  const gridCardW = (contentWidth - 14) / 2; // 80mm each
  const summaryCardH = 50;

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, summaryCardH, 2, 2, "FD");

  renderCardTitle("(02) LOAN PORTFOLIO SUMMARY");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  const gridStartY = y + 12;

  const summaryItems = [
    { label: "LOAN ID", val: data.loanId.slice(0, 18).toUpperCase(), isBold: true },
    { label: "LOAN ISSUE DATE", val: data.dateGiven || "N/A" },
    { label: "CURRENT DUE DATE", val: data.dueDate || "N/A", isGold: true },
    { label: "STATEMENT DATE", val: data.statementDate.split(",")[0]! },
    { label: "ORIGINAL PRINCIPAL", val: formatMoney(data.principal, false), isBold: true },
    { label: "INTEREST RATE BASIS", val: `Rs. ${data.interestRate} / Rs. 1,000 / month` },
  ];

  summaryItems.forEach((sc, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);

    const cx = margin + 5 + colIdx * (gridCardW + 4);
    const cy = gridStartY + rowIdx * 17.5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(230, 224, 205);
    doc.roundedRect(cx, cy, gridCardW, 15.5, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(sc.label, cx + 4, cy + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (sc.isGold) {
      doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    } else {
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    }
    doc.text(sc.val, cx + 4, cy + 11);
  });

  y += summaryCardH + 5;

  // ═════════════════════════════════════════════════════════════════════════
  // (03) CURRENT FINANCIAL POSITION (PLACED ON PAGE 1 — ZERO WASTED BLANK SPACE!)
  // ═════════════════════════════════════════════════════════════════════════
  const finCardH = 68;

  // Checks space; if not fitting 100%, checks if it fits on Page 1 or moves cleanly
  checkPageBreak(finCardH);

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, finCardH, 2, 2, "FD");

  renderCardTitle("(03) CURRENT FINANCIAL POSITION");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  let finY = y + 14;

  // Highlighted Light Banner Box for NET CURRENT TOTAL PAYABLE
  doc.setFillColor(248, 244, 230);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin + 5, finY, contentWidth - 10, 15, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("NET CURRENT TOTAL PAYABLE", margin + 10, finY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text(formatMoney(data.totalPayable, true), maxRightX - 10, finY + 10.5, { align: "right" });

  finY += 20;

  const finItems = [
    { label: "ORIGINAL PRINCIPAL", val: formatMoney(data.principal, false) },
    { label: "TOTAL PAYMENTS CREDITED", val: `- ${formatMoney(data.totalPayments, true)}`, isGreen: true },
    { label: "OUTSTANDING PRINCIPAL BALANCE", val: formatMoney(data.outstandingBalance, true), isBold: true },
  ];

  finItems.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(item.label, margin + 8, finY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (item.isGreen) {
      doc.setTextColor(14, 94, 46);
    } else {
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    }
    doc.text(item.val, maxRightX - 8, finY, { align: "right" });

    finY += 10;
  });

  y += finCardH + 6;

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 2 STARTS HERE (INTENTIONAL, ELEGANT PAGE 2 FLOW)
  // ═════════════════════════════════════════════════════════════════════════
  checkPageBreak(58);

  // (04) ITEMIZED CALCULATION BREAKDOWN
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 54, 2, 2, "FD");

  renderCardTitle("(04) ITEMIZED CALCULATION BREAKDOWN");
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
  doc.text("CALCULATION FORMULA & BASIS", margin + 65, tblY + 4);
  doc.text("ITEMIZED AMOUNT", maxRightX - 8, tblY + 4, { align: "right" });

  const accountingRows = [
    { desc: "Loan Principal", basis: "Original Disbursed Principal", amt: `+ ${formatMoney(data.principal, true)}` },
    { desc: "Accrued Interest", basis: `Rs. ${data.interestRate} / Rs. 1,000 / month`, amt: `+ ${formatMoney(data.totalInterest, true)}` },
    { desc: "Overdue Penalty", basis: data.isOverdue ? `Rs. ${data.penaltyRate || 20} / day x ${data.overdueDays} days` : "No Penalty (On Time)", amt: `+ ${formatMoney(data.accruedPenalty, true)}` },
    { desc: "Payments Received", basis: `${data.payments.length} Payment Credit(s) Recorded`, amt: `- ${formatMoney(data.totalPayments, true)}` },
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
  doc.text("NET CURRENT PAYABLE", margin + 8, totalLineY + 5.5);
  doc.text(formatMoney(data.totalPayable, true), maxRightX - 8, totalLineY + 5.5, { align: "right" });

  y += 60;

  // ═════════════════════════════════════════════════════════════════════════
  // (05) REPAYMENT RECORD & TRANSACTION LOG (NON-SPLITTABLE TRANSACTION BLOCKS)
  // ═════════════════════════════════════════════════════════════════════════
  const hasPayments = data.payments.length > 0;

  if (hasPayments) {
    data.payments.forEach((p, pIdx) => {
      const remarkText = p.notes || "Monthly interest payment received for the current loan cycle.";
      const wrappedRemark = doc.splitTextToSize(remarkText, contentWidth - 14);
      const txCardH = Math.max(50, 42 + wrappedRemark.length * 4);

      // Moves transaction block if remaining page height is insufficient
      checkPageBreak(txCardH + 5);

      doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.roundedRect(margin, y, contentWidth, txCardH, 2, 2, "FD");

      renderCardTitle(`(05) REPAYMENT RECORD #${String(pIdx + 1).padStart(2, "0")}`);
      doc.setDrawColor(228, 220, 195);
      doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

      let pY = y + 14;

      // PAYMENT DATE & TRANSACTION ID
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("PAYMENT DATE", margin + 7, pY);
      doc.text("TRANSACTION ID", margin + 70, pY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
      doc.text(p.paymentDate, margin + 7, pY + 4.5);
      doc.text(p.paymentId.toUpperCase(), margin + 70, pY + 4.5);

      pY += 11;

      // TYPE / REMARK
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("TYPE / REMARK", margin + 7, pY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
      doc.text(wrappedRemark, margin + 7, pY + 4.5);

      pY += 6 + wrappedRemark.length * 4;

      // STATUS & AMOUNT CREDITED
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("STATUS", margin + 7, pY);
      doc.text("AMOUNT CREDITED", margin + 70, pY);

      doc.setFillColor(232, 245, 233);
      doc.setDrawColor(160, 212, 164);
      doc.roundedRect(margin + 7, pY + 2, 22, 5, 1, 1, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(14, 94, 46);
      doc.text("RECEIVED", margin + 9.5, pY + 5.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
      doc.text(formatMoney(p.amount, true), margin + 70, pY + 6);

      y += txCardH + 5;
    });
  } else {
    const noPayCardH = 24;
    checkPageBreak(noPayCardH + 5);

    doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
    doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
    doc.roundedRect(margin, y, contentWidth, noPayCardH, 2, 2, "FD");

    renderCardTitle("(05) REPAYMENT RECORD & TRANSACTION LOG");
    doc.setDrawColor(228, 220, 195);
    doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text("No repayment transactions recorded prior to the statement date.", margin + 7, y + 16);

    y += noPayCardH + 5;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // (06) NOTES & RECORD REMARKS
  // ═════════════════════════════════════════════════════════════════════════
  const noteText = data.notes || "No additional remarks recorded for this loan portfolio.";
  const wrappedNotes = doc.splitTextToSize(noteText, contentWidth - 14);
  const notesCardH = Math.max(22, 14 + wrappedNotes.length * 4);

  checkPageBreak(notesCardH + 5);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, notesCardH, 2, 2, "FD");

  renderCardTitle("(06) NOTES & RECORD REMARKS");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(wrappedNotes, margin + 7, y + 15);

  y += notesCardH + 6;

  // ═════════════════════════════════════════════════════════════════════════
  // (07) THANK YOU & ENTERPRISE CLOSING (PLACED NATURALLY AT BOTTOM OF PAGE 2)
  // ═════════════════════════════════════════════════════════════════════════
  checkPageBreak(22);
  doc.setFillColor(250, 248, 242);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("Thank You", pageWidth / 2, y + 7, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("FINEXA — Smart Loan Management System", pageWidth / 2, y + 12.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("This statement is an official system-generated record. For inquiries, contact your account administrator.", pageWidth / 2, y + 16.5, { align: "center" });

  // Render Header & Footer Across All Pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderHeaderFooter(i, totalPages);
  }

  // Trigger File Download
  const cleanBorrower = data.borrowerName.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `FINEXA_Current_Statement_${cleanBorrower}_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;
  doc.save(filename);
}
