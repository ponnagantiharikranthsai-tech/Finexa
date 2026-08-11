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
  const bottomMargin = 25;  // Bottom 25mm
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
    doc.line(margin, pageHeight - 14, maxRightX, pageHeight - 14);

    // Footer Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text("FINEXA — Smart Loan Management System | Official System-Generated Current Statement", margin, pageHeight - 8);
    doc.text(`Doc ID: ${data.documentId} | Page ${pageNum} of ${totalPages}`, maxRightX, pageHeight - 8, { align: "right" });

    doc.restoreGraphicsState();
  }

  // Page Break Intelligence — Moves entire card if needed height exceeds remaining space
  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - bottomMargin - 5) {
      doc.addPage();
      y = topMargin + 4;
    }
  }

  function renderCardTitle(titleStr: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    doc.text(titleStr.toUpperCase(), margin + 6, y + 7);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 1. DOCUMENT TITLE BANNER & STATUS BADGE
  // ═════════════════════════════════════════════════════════════════════════
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("CURRENT LOAN STATEMENT", margin, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text(`Statement Date: ${data.statementDate}`, maxRightX, y + 4, { align: "right" });

  y += 9;
  doc.setDrawColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, maxRightX, y);
  y += 8;

  // Status Banner Box (Overdue vs Due Soon vs Active)
  checkPageBreak(22);
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
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(bannerText[0], bannerText[1], bannerText[2]);
  doc.text(bannerTitle, margin + 6, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(bannerSub, margin + 6, y + 13);

  y += 24;

  // ═════════════════════════════════════════════════════════════════════════
  // (01) BORROWER INFORMATION CARD
  // ═════════════════════════════════════════════════════════════════════════
  const colW = (contentWidth - 18) / 2; // 78mm per column
  const leftColX = margin + 6;
  const rightColX = margin + colW + 12;

  const panStr = data.panDecrypted ? data.panDecrypted : "Not Provided";
  const aadhaarStr = data.aadhaarDecrypted ? data.aadhaarDecrypted : "Not Provided";

  const wrappedPan = doc.splitTextToSize(panStr, colW - 4);
  const wrappedAadhaar = doc.splitTextToSize(aadhaarStr, colW - 4);

  const panLinesHeight = wrappedPan.length * 4;
  const aadhaarLinesHeight = wrappedAadhaar.length * 4;
  const kycTotalH = 14 + panLinesHeight + aadhaarLinesHeight;
  const cardBodyH = Math.max(52, kycTotalH + 16);

  checkPageBreak(cardBodyH + 8);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, cardBodyH, 2, 2, "FD");

  renderCardTitle("(01) BORROWER INFORMATION");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  let bRowY = y + 16;

  // Left Column
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("CUSTOMER NAME", leftColX, bRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text(data.borrowerName, leftColX, bRowY + 5);

  bRowY += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("MOBILE NUMBER", leftColX, bRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(data.mobile, leftColX, bRowY + 5);

  bRowY += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("EMAIL ADDRESS", leftColX, bRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(data.email || "N/A", leftColX, bRowY + 5);

  // Right Column
  let rRowY = y + 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("PAN NUMBER", rightColX, rRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(wrappedPan, rightColX, rRowY + 5);

  rRowY += 8 + panLinesHeight;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("AADHAAR NUMBER", rightColX, rRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(wrappedAadhaar, rightColX, rRowY + 5);

  y += cardBodyH + 10;

  // ═════════════════════════════════════════════════════════════════════════
  // (02) LOAN PORTFOLIO SUMMARY (DYNAMIC EXPANSION & 40px BOTTOM PADDING)
  // ═════════════════════════════════════════════════════════════════════════
  const gridCardW = (contentWidth - 18) / 2; // 78mm each

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const loanIdWrapped = doc.splitTextToSize(data.loanId.toUpperCase(), gridCardW - 10);
  const loanIdH = Math.max(18, 12 + loanIdWrapped.length * 4);

  // Ensure 14mm (40px) bottom padding below the last inner row before the card border
  const summaryCardH = 14 + loanIdH + 46;

  checkPageBreak(summaryCardH + 8);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, summaryCardH, 2, 2, "FD");

  renderCardTitle("(02) LOAN PORTFOLIO SUMMARY");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  const gridStartY = y + 14;

  const summaryItems = [
    { label: "LOAN ID", val: loanIdWrapped, isBold: true, customH: loanIdH },
    { label: "LOAN ISSUE DATE", val: data.dateGiven || "N/A", customH: 18 },
    { label: "CURRENT DUE DATE", val: data.dueDate || "N/A", isGold: true, customH: 18 },
    { label: "STATEMENT DATE", val: data.statementDate.split(",")[0]!, customH: 18 },
    { label: "ORIGINAL PRINCIPAL", val: formatMoney(data.principal, false), isBold: true, customH: 18 },
    { label: "INTEREST RATE BASIS", val: `Rs. ${data.interestRate} / Rs. 1,000 / month`, customH: 18 },
  ];

  summaryItems.forEach((sc, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);

    const cx = margin + 6 + colIdx * (gridCardW + 6);
    let cy = gridStartY;
    if (rowIdx === 1) cy = gridStartY + loanIdH + 3;
    if (rowIdx === 2) cy = gridStartY + loanIdH + 3 + 21;

    const currentH = sc.customH || 18;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(230, 224, 205);
    doc.roundedRect(cx, cy, gridCardW, currentH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(sc.label, cx + 5, cy + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (sc.isGold) {
      doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    } else {
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    }
    doc.text(sc.val, cx + 5, cy + 12);
  });

  y += summaryCardH + 10;

  // ═════════════════════════════════════════════════════════════════════════
  // (03) CURRENT FINANCIAL POSITION (ONE SINGLE LIGHT CARD — ZERO DARK BOXES)
  // ═════════════════════════════════════════════════════════════════════════
  const finCardH = 86; // Clean vertical presentation with 40px bottom padding

  checkPageBreak(finCardH + 8);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, finCardH, 2, 2, "FD");

  renderCardTitle("(03) CURRENT FINANCIAL POSITION");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  let finY = y + 16;

  // NET CURRENT TOTAL PAYABLE (Highlighted Light Banner Box inside Card)
  doc.setFillColor(248, 244, 230);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin + 6, finY, contentWidth - 12, 16, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("NET CURRENT TOTAL PAYABLE", margin + 12, finY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text(formatMoney(data.totalPayable, true), maxRightX - 12, finY + 11, { align: "right" });

  finY += 22;

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
    doc.setFontSize(9.5);
    if (item.isGreen) {
      doc.setTextColor(14, 94, 46);
    } else {
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    }
    doc.text(item.val, maxRightX - 8, finY, { align: "right" });

    finY += 11;
  });

  y += finCardH + 10;

  // ═════════════════════════════════════════════════════════════════════════
  // (04) ITEMIZED CALCULATION BREAKDOWN (EXPLICIT ACCOUNTING TABLE)
  // ═════════════════════════════════════════════════════════════════════════
  checkPageBreak(66);

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 60, 2, 2, "FD");

  renderCardTitle("(04) ITEMIZED CALCULATION BREAKDOWN");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  // Table Header Bar with Distinct Styling
  const tblY = y + 14;
  doc.setFillColor(240, 234, 215);
  doc.rect(margin + 6, tblY, contentWidth - 12, 6.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("LINE ITEM DESCRIPTION", margin + 10, tblY + 4.5);
  doc.text("CALCULATION FORMULA & BASIS", margin + 68, tblY + 4.5);
  doc.text("ITEMIZED AMOUNT", maxRightX - 10, tblY + 4.5, { align: "right" });

  // Explicit Accounting Itemization Rows
  const accountingRows = [
    { desc: "Loan Principal", basis: "Original Principal Disbursed", amt: `+ ${formatMoney(data.principal, true)}` },
    { desc: "Accrued Interest", basis: `Rs. ${data.interestRate} / Rs. 1,000 / month`, amt: `+ ${formatMoney(data.totalInterest, true)}` },
    { desc: "Overdue Penalty", basis: data.isOverdue ? `Rs. ${data.penaltyRate || 20} / day x ${data.overdueDays} days` : "No Penalty (On Time)", amt: `+ ${formatMoney(data.accruedPenalty, true)}` },
    { desc: "Payments Received", basis: `${data.payments.length} Payment Credit(s) Recorded`, amt: `- ${formatMoney(data.totalPayments, true)}` },
  ];

  accountingRows.forEach((row, idx) => {
    const rowTop = tblY + 8 + idx * 6.5;
    if (idx % 2 === 1) {
      doc.setFillColor(250, 248, 242);
      doc.rect(margin + 6, rowTop - 1.5, contentWidth - 12, 6.5, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
    doc.text(row.desc, margin + 10, rowTop + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(row.basis, margin + 68, rowTop + 3);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.text(row.amt, maxRightX - 10, rowTop + 3, { align: "right" });
  });

  // Table Bottom Summary Row
  const totalLineY = tblY + 36;
  doc.setDrawColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 6, totalLineY, maxRightX - 6, totalLineY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("NET CURRENT PAYABLE", margin + 10, totalLineY + 6);
  doc.text(formatMoney(data.totalPayable, true), maxRightX - 10, totalLineY + 6, { align: "right" });

  y += 68;

  // ═════════════════════════════════════════════════════════════════════════
  // (05) REPAYMENT RECORD & TRANSACTION LOG (VERTICAL TRANSACTION CARDS)
  // ═════════════════════════════════════════════════════════════════════════
  const hasPayments = data.payments.length > 0;

  if (hasPayments) {
    data.payments.forEach((p, pIdx) => {
      const remarkText = p.notes || "Monthly interest payment received for the current loan cycle.";
      const wrappedRemark = doc.splitTextToSize(remarkText, contentWidth - 16);

      // Dynamic card height calculation ensuring 32px bottom padding
      const txCardH = Math.max(68, 54 + wrappedRemark.length * 4.5);

      checkPageBreak(txCardH + 8);

      doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.roundedRect(margin, y, contentWidth, txCardH, 2, 2, "FD");

      renderCardTitle(`(05) REPAYMENT RECORD #${String(pIdx + 1).padStart(2, "0")}`);
      doc.setDrawColor(228, 220, 195);
      doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

      let pY = y + 16;

      // PAYMENT DATE
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("PAYMENT DATE", margin + 8, pY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
      doc.text(p.paymentDate, margin + 8, pY + 5);

      pY += 12;

      // TRANSACTION ID
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("TRANSACTION ID", margin + 8, pY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
      doc.text(p.paymentId.toUpperCase(), margin + 8, pY + 5);

      pY += 12;

      // TYPE / REMARK (Dynamic Multi-Line Wrapping)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("TYPE / REMARK", margin + 8, pY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
      doc.text(wrappedRemark, margin + 8, pY + 5);

      pY += 7 + wrappedRemark.length * 4.5;

      // STATUS & AMOUNT CREDITED (Padded Grid Row inside Card)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text("STATUS", margin + 8, pY);
      doc.text("AMOUNT CREDITED", margin + 85, pY);

      // Status Badge Pill
      doc.setFillColor(232, 245, 233);
      doc.setDrawColor(160, 212, 164);
      doc.roundedRect(margin + 8, pY + 2.5, 24, 5.5, 1, 1, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(14, 94, 46);
      doc.text("RECEIVED", margin + 10.5, pY + 6.2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
      doc.text(formatMoney(p.amount, true), margin + 85, pY + 7);

      y += txCardH + 10; // 10mm (30px) vertical gap between separate repayment transaction cards
    });
  } else {
    const noPayCardH = 28;
    checkPageBreak(noPayCardH + 8);

    doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
    doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
    doc.roundedRect(margin, y, contentWidth, noPayCardH, 2, 2, "FD");

    renderCardTitle("(05) REPAYMENT RECORD & TRANSACTION LOG");
    doc.setDrawColor(228, 220, 195);
    doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text("No repayment transactions recorded prior to the statement date.", margin + 8, y + 19);

    y += noPayCardH + 10;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // (06) NOTES & RECORD REMARKS
  // ═════════════════════════════════════════════════════════════════════════
  const noteText = data.notes || "No additional remarks recorded for this loan portfolio.";
  const wrappedNotes = doc.splitTextToSize(noteText, contentWidth - 16);
  const notesCardH = Math.max(28, 16 + wrappedNotes.length * 4.5);

  checkPageBreak(notesCardH + 6);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, notesCardH, 2, 2, "FD");

  renderCardTitle("(06) NOTES & RECORD REMARKS");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(wrappedNotes, margin + 8, y + 17);

  y += notesCardH + 10;

  // ═════════════════════════════════════════════════════════════════════════
  // (07) THANK YOU & ENTERPRISE CLOSING
  // ═════════════════════════════════════════════════════════════════════════
  checkPageBreak(28);
  doc.setFillColor(250, 248, 242);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("Thank You", pageWidth / 2, y + 9, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("FINEXA — Smart Loan Management System", pageWidth / 2, y + 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("This statement is an official system-generated record. For inquiries, contact your account administrator.", pageWidth / 2, y + 20, { align: "center" });

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
