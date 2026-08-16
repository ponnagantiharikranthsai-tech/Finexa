import { format } from "date-fns";

export type PartialPaymentResultPayload = {
  documentId: string;
  receiptNumber: string;
  transactionId: string;
  paymentDate: string;
  paymentTime?: string;

  loanId: string;
  applicationCode?: string;
  borrowerName: string;
  borrowerMobile: string;
  fatherName?: string;
  fatherMobile?: string;
  email?: string;
  address?: string;

  dateGiven?: string;
  dueDate?: string;
  principal: number;
  interestAmount?: number;
  totalPayable: number;
  loanType: string; // e.g., "Monthly", "Weekly", "Daily"

  previousPaidAmount: number;
  currentPaymentAmount: number;
  totalPaidTillDate: number;
  remainingBalance: number;
  paymentStatus: "PARTIAL PAYMENT" | "PAID / COMPLETED";

  paymentsHistory: Array<{
    receiptNo: string;
    date: string;
    amountPaid: number;
    totalPaid: number;
    balance: number;
    paymentType?: string;
    notes?: string | null;
  }>;
};

// Canvas Helper: Renders Authentic Gold/Amber FINEXA Partial Payment Confirmation Seal
export function createPartialPaymentStampImage(paymentDateStr: string): string {
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  const size = 700;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const context = ctx;
  const cx = size / 2;
  const cy = size / 2;

  let formattedDate = paymentDateStr;
  try {
    const parts = paymentDateStr.split("-");
    if (parts.length === 3) {
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(dateObj.getTime())) {
        formattedDate = format(dateObj, "MMMM dd, yyyy").toUpperCase();
      }
    } else {
      const dateObj = new Date(paymentDateStr);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = format(dateObj, "MMMM dd, yyyy").toUpperCase();
      }
    }
  } catch (e) {
    formattedDate = paymentDateStr.toUpperCase();
  }

  // Stamp Accent Color: Deep Gold / Amber Ink Palette (#B8860B)
  const stampColor = "#B8860B";

  context.clearRect(0, 0, size, size);
  context.save();

  // Rotate -3 degrees for authentic seal texture
  context.translate(cx, cy);
  context.rotate(-0.05);
  context.translate(-cx, -cy);

  context.globalAlpha = 0.92;

  // Outer Circular Ring
  context.strokeStyle = stampColor;
  context.lineWidth = 14;
  context.beginPath();
  context.arc(cx, cy, 320, 0, Math.PI * 2);
  context.stroke();

  // Inner Dashed Circular Ring
  context.lineWidth = 4;
  context.setLineDash([12, 10]);
  context.beginPath();
  context.arc(cx, cy, 300, 0, Math.PI * 2);
  context.stroke();

  // Reset dashed line
  context.setLineDash([]);

  // Top Circular Text "FINEXA SMART LOAN MANAGEMENT"
  context.font = "bold 34px sans-serif";
  context.fillStyle = stampColor;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const topText = "FINEXA  •  SMART LOAN MANAGEMENT";
  for (let i = 0; i < topText.length; i++) {
    const char = topText[i];
    const angle = -Math.PI / 1.35 + (i * Math.PI * 1.5) / topText.length;
    context.save();
    context.translate(cx + Math.cos(angle) * 260, cy + Math.sin(angle) * 260);
    context.rotate(angle + Math.PI / 2);
    context.fillText(char, 0, 0);
    context.restore();
  }

  // Center Box Container
  const boxW = 460;
  const boxH = 170;
  const boxX = cx - boxW / 2;
  const boxY = cy - boxH / 2;

  context.fillStyle = "rgba(255, 255, 255, 0.95)";
  context.fillRect(boxX, boxY, boxW, boxH);
  context.strokeStyle = stampColor;
  context.lineWidth = 6;
  context.strokeRect(boxX, boxY, boxW, boxH);

  // Center Banner Text: "PARTIAL PAYMENT"
  context.font = "900 38px sans-serif";
  context.fillStyle = stampColor;
  context.fillText("PARTIAL PAYMENT", cx, boxY + 44);

  // Divider Line
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(boxX + 20, boxY + 74);
  context.lineTo(boxX + boxW - 20, boxY + 74);
  context.stroke();

  // Dynamic Payment Date
  context.font = "bold 26px sans-serif";
  context.fillText(formattedDate, cx, boxY + 108);

  // System Marking
  context.font = "bold 15px sans-serif";
  context.fillText("• PAYMENT RECEIPT CONFIRMATION •", cx, boxY + 144);

  context.restore();
  return canvas.toDataURL("image/png");
}

export async function buildPartialPaymentJsPdfDoc(data: PartialPaymentResultPayload) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // Layout Margins
  const margin = 18;
  const topMargin = 25;
  const contentWidth = 174;
  const maxRightX = pageWidth - margin;
  const sectionGap = 7;

  // Executive Palette Tokens
  const COLOR_NAVY = [15, 20, 30];
  const COLOR_GOLD = [184, 134, 11];
  const COLOR_LIGHT_GOLD = [212, 168, 67];
  const COLOR_TEXT = [35, 40, 48];
  const COLOR_MUTED = [100, 110, 125];
  const COLOR_CARD_BG = [252, 251, 244];
  const COLOR_CARD_BORDER = [226, 216, 191];

  const COLOR_AMBER_BG = [254, 252, 232];
  const COLOR_AMBER_BORDER = [253, 224, 71];
  const COLOR_AMBER_TEXT = [113, 63, 18];

  let y = topMargin;

  function formatMoney(amount: number | string, includeDecimals = true): string {
    const num = Number(amount || 0);
    if (isNaN(num)) return "Rs. 0.00";
    if (includeDecimals) {
      return `Rs. ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `Rs. ${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }

  function renderHeaderFooter(pageNum: number, totalPages: number) {
    doc.saveGraphicsState();

    // Top Header Bar
    doc.setFillColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.rect(0, 0, pageWidth, 16, "F");

    // Accent Gold Line
    doc.setFillColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    doc.rect(0, 16, pageWidth, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLOR_LIGHT_GOLD[0], COLOR_LIGHT_GOLD[1], COLOR_LIGHT_GOLD[2]);
    doc.text("FINEXA", margin, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(200, 205, 215);
    doc.text("SMART LOAN MANAGEMENT SYSTEM  •  PARTIAL PAYMENT RECEIPT", margin + 18, 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_LIGHT_GOLD[0], COLOR_LIGHT_GOLD[1], COLOR_LIGHT_GOLD[2]);
    doc.text(`RECEIPT: ${data.receiptNumber || data.documentId}`, maxRightX, 11, { align: "right" });

    // Footer Line
    doc.setDrawColor(215, 215, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, maxRightX, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text("FINEXA Financial Software  |  Official Partial Payment Receipt", margin, pageHeight - 7);

    doc.text(`Page ${pageNum} of ${totalPages}`, maxRightX, pageHeight - 7, { align: "right" });

    doc.restoreGraphicsState();
  }

  function checkPageBreak(requiredHeight: number) {
    if (y + requiredHeight > pageHeight - 20) {
      doc.addPage();
      y = topMargin;
    }
  }

  function renderCardTitle(title: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    doc.text(title.toUpperCase(), margin + 5, y + 6);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // (01) DOCUMENT HEADER BANNER & STATUS BADGE
  // ═════════════════════════════════════════════════════════════════════════
  const bannerH = 26;
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, bannerH, 2.5, 2.5, "FD");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("PARTIAL PAYMENT RECEIPT", margin + 7, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text(`Receipt No: ${data.receiptNumber || data.documentId}   |   Date: ${data.paymentDate} ${data.paymentTime ? `(${data.paymentTime})` : ""}`, margin + 7, y + 17);

  // Status Badge (PARTIAL PAYMENT)
  const badgeW = 38;
  const badgeH = 7.5;
  const badgeX = maxRightX - badgeW - 7;
  const badgeY = y + 9;

  doc.setFillColor(COLOR_AMBER_BG[0], COLOR_AMBER_BG[1], COLOR_AMBER_BG[2]);
  doc.setDrawColor(COLOR_AMBER_BORDER[0], COLOR_AMBER_BORDER[1], COLOR_AMBER_BORDER[2]);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_AMBER_TEXT[0], COLOR_AMBER_TEXT[1], COLOR_AMBER_TEXT[2]);
  doc.text("PARTIAL PAYMENT", badgeX + badgeW / 2, badgeY + 5, { align: "center" });

  y += bannerH + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // (02) BORROWER & LOAN PROFILE CARDS (TWO COLUMNS)
  // ═════════════════════════════════════════════════════════════════════════
  const colWidth = (contentWidth - 5) / 2; // 84.5mm each
  const card02H = 40;

  // Left Box: Borrower Info
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, colWidth, card02H, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("BORROWER INFORMATION", margin + 5, y + 6);
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, margin + colWidth - 5, y + 9);

  let bY = y + 14;
  const labelX = margin + 5;
  const valX = margin + 32;

  const borrowerRows = [
    { label: "Name", val: data.borrowerName },
    { label: "Mobile", val: data.borrowerMobile },
    { label: "Loan ID", val: data.loanId.slice(0, 18).toUpperCase() },
    { label: "App Code", val: data.applicationCode || "N/A" },
  ];

  borrowerRows.forEach((r) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(r.label, labelX, bY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.text(r.val, valX, bY);
    bY += 6;
  });

  // Right Box: Loan Parameters
  const rightColX = margin + colWidth + 5;
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(rightColX, y, colWidth, card02H, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("LOAN PARAMETERS", rightColX + 5, y + 6);
  doc.line(rightColX + 5, y + 9, rightColX + colWidth - 5, y + 9);

  let lY = y + 14;
  const lLabelX = rightColX + 5;
  const lValX = rightColX + 34;

  const loanRows = [
    { label: "Principal", val: formatMoney(data.principal) },
    { label: "Interest", val: data.interestAmount ? formatMoney(data.interestAmount) : "Included" },
    { label: "Total Payable", val: formatMoney(data.totalPayable) },
    { label: "Loan Type", val: (data.loanType || "Monthly").toUpperCase() },
  ];

  loanRows.forEach((r) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(r.label, lLabelX, lY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.text(r.val, lValX, lY);
    lY += 6;
  });

  y += card02H + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // (03) PAYMENT ACCOUNTING BREAKDOWN
  // ═════════════════════════════════════════════════════════════════════════
  const card03H = 46;
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, card03H, 2, 2, "FD");

  renderCardTitle("PAYMENT ACCOUNTING BREAKDOWN");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  // Table Header Bar
  const tblY = y + 13;
  doc.setFillColor(240, 234, 215);
  doc.rect(margin + 5, tblY, contentWidth - 10, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("ACCOUNTING LINE ITEM", margin + 8, tblY + 4);
  doc.text("DESCRIPTION", margin + 65, tblY + 4);
  doc.text("AMOUNT", maxRightX - 8, tblY + 4, { align: "right" });

  const acctRows = [
    { item: "Total Payable", desc: "Original Contractual Loan Amount", amt: formatMoney(data.totalPayable) },
    { item: "Previous Paid Amount", desc: "Sum of payments credited before this transaction", amt: `- ${formatMoney(data.previousPaidAmount)}` },
    { item: "Current Payment Amount", desc: "Amount credited in this partial transaction", amt: `- ${formatMoney(data.currentPaymentAmount)}` },
    { item: "Total Paid Till Date", desc: "Cumulative payments credited to portfolio to date", amt: formatMoney(data.totalPaidTillDate) },
  ];

  acctRows.forEach((row, idx) => {
    const rowTop = tblY + 7 + idx * 5.5;
    if (idx % 2 === 1) {
      doc.setFillColor(250, 248, 242);
      doc.rect(margin + 5, rowTop - 1, contentWidth - 10, 5.5, "F");
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
    doc.text(row.item, margin + 8, rowTop + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(row.desc, margin + 65, rowTop + 3);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.text(row.amt, maxRightX - 8, rowTop + 3, { align: "right" });
  });

  // Table Bottom Summary Line
  const totalLineY = tblY + 29;
  doc.setDrawColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 5, totalLineY, maxRightX - 5, totalLineY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("REMAINING OUTSTANDING BALANCE", margin + 8, totalLineY + 5);
  doc.text(formatMoney(data.remainingBalance), maxRightX - 8, totalLineY + 5, { align: "right" });

  y += card03H + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // (04) CUMULATIVE PAYMENT HISTORY TABLE
  // ═════════════════════════════════════════════════════════════════════════
  const historyList = data.paymentsHistory || [];
  const historyRowsCount = Math.max(1, historyList.length);
  const histCardH = 18 + historyRowsCount * 6;

  checkPageBreak(histCardH);

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, histCardH, 2, 2, "FD");

  renderCardTitle("PAYMENT HISTORY");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 5, y + 9, maxRightX - 5, y + 9);

  const hTblY = y + 13;
  doc.setFillColor(240, 234, 215);
  doc.rect(margin + 5, hTblY, contentWidth - 10, 5.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("DATE", margin + 8, hTblY + 3.8);
  doc.text("RECEIPT NO.", margin + 35, hTblY + 3.8);
  doc.text("AMOUNT PAID", margin + 85, hTblY + 3.8, { align: "right" });
  doc.text("TOTAL PAID", margin + 128, hTblY + 3.8, { align: "right" });
  doc.text("BALANCE", maxRightX - 8, hTblY + 3.8, { align: "right" });

  if (historyList.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text("No prior payment history recorded.", margin + 8, hTblY + 10);
  } else {
    historyList.forEach((h, hIdx) => {
      const hRowTop = hTblY + 6 + hIdx * 6;
      if (hIdx % 2 === 1) {
        doc.setFillColor(250, 248, 242);
        doc.rect(margin + 5, hRowTop - 1, contentWidth - 10, 6, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
      doc.text(h.date, margin + 8, hRowTop + 3.5);

      doc.setFont("helvetica", "bold");
      doc.text(h.receiptNo, margin + 35, hRowTop + 3.5);

      doc.setFont("helvetica", "normal");
      doc.text(formatMoney(h.amountPaid), margin + 85, hRowTop + 3.5, { align: "right" });
      doc.text(formatMoney(h.totalPaid), margin + 128, hRowTop + 3.5, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
      doc.text(formatMoney(h.balance), maxRightX - 8, hRowTop + 3.5, { align: "right" });
    });
  }

  y += histCardH + sectionGap;

  // ═════════════════════════════════════════════════════════════════════════
  // (05) HIGHLIGHTS SUMMARY CARD & DIGITAL CONFIRMATION SEAL
  // ═════════════════════════════════════════════════════════════════════════
  const cardHighlightH = 46;
  checkPageBreak(cardHighlightH);

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, cardHighlightH, 2.5, 2.5, "FD");

  // Left Column: Amount Received & Remaining Balance Highlight Boxes
  const boxWidth = 52;
  const box1X = margin + 8;
  const box2X = margin + 65;
  const boxesY = y + 10;

  // Box 1: Amount Received
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(box1X, boxesY, boxWidth, 26, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text("AMOUNT RECEIVED", box1X + 6, boxesY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(22, 101, 52);
  doc.text(formatMoney(data.currentPaymentAmount), box1X + 6, boxesY + 18);

  // Box 2: Remaining Balance
  doc.setFillColor(COLOR_AMBER_BG[0], COLOR_AMBER_BG[1], COLOR_AMBER_BG[2]);
  doc.setDrawColor(COLOR_AMBER_BORDER[0], COLOR_AMBER_BORDER[1], COLOR_AMBER_BORDER[2]);
  doc.roundedRect(box2X, boxesY, boxWidth, 26, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_AMBER_TEXT[0], COLOR_AMBER_TEXT[1], COLOR_AMBER_TEXT[2]);
  doc.text("REMAINING BALANCE", box2X + 6, boxesY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(COLOR_AMBER_TEXT[0], COLOR_AMBER_TEXT[1], COLOR_AMBER_TEXT[2]);
  doc.text(formatMoney(data.remainingBalance), box2X + 6, boxesY + 18);

  // Right Column: Gold/Amber Digital Confirmation Seal
  const stampSize = 38;
  const stampImgData = createPartialPaymentStampImage(data.paymentDate);
  if (stampImgData) {
    const stampX = maxRightX - stampSize - 6;
    const stampY = y + (cardHighlightH - stampSize) / 2;
    doc.addImage(stampImgData, "PNG", stampX, stampY, stampSize, stampSize);
  }

  y += cardHighlightH + sectionGap;

  // Render Header & Footer Across All Pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderHeaderFooter(i, totalPages);
  }

  return doc;
}

// Triggers direct file download
export async function downloadPartialPaymentPdf(data: PartialPaymentResultPayload): Promise<void> {
  const doc = await buildPartialPaymentJsPdfDoc(data);
  const words = (data.borrowerName || "")
    .replace(/[().,_\-\/]/g, " ")
    .replace(/[^\w\s]/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const cleanBorrower = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("_") || "Borrower";
  const filename = `FINEXA_${cleanBorrower}_Partial_Receipt_${data.receiptNumber || data.documentId}.pdf`;
  doc.save(filename);
}

// Opens PDF in new browser tab for viewing
export async function viewPartialPaymentPdf(data: PartialPaymentResultPayload): Promise<void> {
  const doc = await buildPartialPaymentJsPdfDoc(data);
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
}

// Opens print dialog for instant printing
export async function printPartialPaymentPdf(data: PartialPaymentResultPayload): Promise<void> {
  const doc = await buildPartialPaymentJsPdfDoc(data);
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = blobUrl;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 300);
  };
}
