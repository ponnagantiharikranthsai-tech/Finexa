import { jsPDF } from "jspdf";
import { format } from "date-fns";
import type { PayAndExtendResultPayload } from "../actions/pay-and-extend.action";

export function generateLoanExtensionPdf(data: PayAndExtendResultPayload): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  
  // Professional A4 Margins (Spacious & Comfortable)
  const margin = 18; // Left & Right 18mm
  const topMargin = 25; // Top 25mm
  const bottomMargin = 25; // Bottom 25mm
  const contentWidth = 174; // 210 - 36
  const maxRightX = pageWidth - margin; // 192mm

  // Executive Color Tokens
  const COLOR_NAVY = [15, 20, 30];        // #0F141E (Deep Executive Navy)
  const COLOR_GOLD = [184, 134, 11];      // #B8860B (FINEXA Gold)
  const COLOR_LIGHT_GOLD = [212, 168, 67]; // #D4A843 (Champagne Gold)
  const COLOR_TEXT = [35, 40, 48];         // #232830 (Dark Charcoal Text)
  const COLOR_MUTED = [100, 110, 125];     // #646E7D (Muted Label Text)
  const COLOR_CARD_BG = [252, 251, 244];   // Warm Ivory Fill (#FCFAF4)
  const COLOR_CARD_BORDER = [226, 216, 191]; // Soft Gold Border (#E2D8BF)
  const COLOR_GREEN_BG = [232, 245, 233];   // Soft Mint Status BG
  const COLOR_GREEN_BORDER = [160, 212, 164];
  const COLOR_GREEN_TEXT = [14, 94, 46];

  let y = topMargin;

  // Currency Formatter (Universal & Clean)
  function formatMoney(amount: number | string, includeDecimals = true): string {
    const num = Number(amount || 0);
    if (isNaN(num)) return "Rs. 0";
    if (includeDecimals) {
      return `Rs. ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `Rs. ${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }

  // Header & Footer Renderer
  function renderHeaderFooter(pageNum: number, totalPages: number) {
    doc.saveGraphicsState();

    // Top Header Bar
    doc.setFillColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.rect(0, 0, pageWidth, 16, "F");

    doc.setFillColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    doc.rect(0, 16, pageWidth, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLOR_LIGHT_GOLD[0], COLOR_LIGHT_GOLD[1], COLOR_LIGHT_GOLD[2]);
    doc.text("FINEXA", margin, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(200, 205, 215);
    doc.text(`SMART LOAN MANAGEMENT SYSTEM  •  LOAN EXTENSION STATEMENT`, margin + 18, 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_LIGHT_GOLD[0], COLOR_LIGHT_GOLD[1], COLOR_LIGHT_GOLD[2]);
    doc.text(`DOC ID: ${data.documentId}`, maxRightX, 11, { align: "right" });

    // Footer
    doc.setDrawColor(215, 215, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, maxRightX, pageHeight - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text("FINEXA — Smart Loan Management System | Official Extension Record", margin, pageHeight - 8);
    doc.text(`Doc ID: ${data.documentId} | Page ${pageNum} of ${totalPages}`, maxRightX, pageHeight - 8, { align: "right" });

    doc.restoreGraphicsState();
  }

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - bottomMargin - 5) {
      doc.addPage();
      y = topMargin + 2;
    }
  }

  function renderCardTitle(titleStr: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    doc.text(titleStr.toUpperCase(), margin + 6, y + 7);
  }

  // Dates Setup
  const paymentDateObj = data.paymentDate ? new Date(data.paymentDate) : new Date();
  const dateFormattedStr = format(paymentDateObj, "dd MMMM yyyy");
  const dayNameStr = format(paymentDateObj, "EEEE");

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 1: OVERVIEW, STATUS & LOAN PARAMETERS
  // ═════════════════════════════════════════════════════════════════════════

  // Document Title Block (Generous 12mm Breathing Space)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("LOAN EXTENSION STATEMENT", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text(`Official Cycle Extension Confirmation  •  Generated on ${dateFormattedStr} (${dayNameStr})`, margin, y);
  y += 12;

  // 1. STATUS BANNER CARD (CLEAN TEXT — ZERO CORRUPTED GLYPHS)
  checkPageBreak(18);
  doc.setFillColor(COLOR_GREEN_BG[0], COLOR_GREEN_BG[1], COLOR_GREEN_BG[2]);
  doc.setDrawColor(COLOR_GREEN_BORDER[0], COLOR_GREEN_BORDER[1], COLOR_GREEN_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "FD");

  doc.setFillColor(COLOR_GREEN_TEXT[0], COLOR_GREEN_TEXT[1], COLOR_GREEN_TEXT[2]);
  doc.roundedRect(margin, y, 3.5, 16, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(COLOR_GREEN_TEXT[0], COLOR_GREEN_TEXT[1], COLOR_GREEN_TEXT[2]);
  doc.text("CONFIRMED  —  LOAN EXTENSION APPROVED", margin + 7, y + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text("Interest payment received successfully  •  Loan remains active  •  Next cycle created", margin + 7, y + 11.5);

  y += 24;

  // 2. CUSTOMER INFORMATION CARD (SPACIOUS PADDING)
  checkPageBreak(44);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 40, 2, 2, "FD");

  renderCardTitle("Customer Information");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  let rowY = y + 17;
  // Left Column
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("CUSTOMER NAME", margin + 7, rowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text(data.borrowerName || "N/A", margin + 7, rowY + 5);

  rowY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("MOBILE NUMBER", margin + 7, rowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text(data.borrowerMobile || "N/A", margin + 7, rowY + 5);

  if (data.fatherName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(`Father: ${data.fatherName}${data.fatherMobile ? " (" + data.fatherMobile + ")" : ""}`, margin + 56, rowY + 5);
  }

  // Right Column
  rowY = y + 17;
  const rightColX = margin + 98;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("LOAN REFERENCE ID", rightColX, rowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text(data.loanId || "N/A", rightColX, rowY + 5);

  rowY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("LOAN ACCOUNT STATUS", rightColX, rowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_GREEN_TEXT[0], COLOR_GREEN_TEXT[1], COLOR_GREEN_TEXT[2]);
  doc.text(data.loanStatus || "ACTIVE / EXTENDED", rightColX, rowY + 5);

  y += 48;

  // 3. LOAN DETAILS CARD (SPACIOUS 6 MINI-CARDS GRID)
  checkPageBreak(56);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 52, 2, 2, "FD");

  renderCardTitle("Loan Details & Cycle Terms");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  const miniCardW = 52;
  const miniCardH = 16;
  const gridStartY = y + 13;

  const miniCards = [
    { label: "LOAN PRINCIPAL", val: formatMoney(data.principal, false), isBold: true },
    { label: "INTEREST RATE BASIS", val: `Rs. ${data.interestRate} / Rs. 1,000 / mo`, isBold: false },
    { label: "LOAN ISSUED DATE", val: data.dateGiven || "N/A", isBold: false },
    { label: "BILLING START DATE", val: data.billingStartDate || data.dateGiven || "N/A", isBold: false },
    { label: "PREVIOUS DUE DATE", val: data.previousDueDate || "N/A", isBold: false },
    { label: "NEW CYCLE DUE DATE", val: data.newDueDate || "N/A", isGold: true },
  ];

  miniCards.forEach((card, idx) => {
    const colIdx = idx % 3;
    const rowIdx = Math.floor(idx / 3);

    const cardX = margin + 5 + colIdx * 56;
    const cardY = gridStartY + rowIdx * 18;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(230, 224, 205);
    doc.roundedRect(cardX, cardY, miniCardW, miniCardH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(card.label, cardX + 4, cardY + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    if (card.isGold) {
      doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    } else {
      doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    }
    doc.text(card.val, cardX + 4, cardY + 11.5);
  });

  y += 62;

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 2: SETTLEMENT, POSITION, TIMELINE & NOTICE
  // ═════════════════════════════════════════════════════════════════════════
  checkPageBreak(50);

  const halfW = (contentWidth - 6) / 2; // 84mm

  // CARD A: PAYMENT SETTLEMENT
  doc.setFillColor(COLOR_GREEN_BG[0], COLOR_GREEN_BG[1], COLOR_GREEN_BG[2]);
  doc.setDrawColor(COLOR_GREEN_BORDER[0], COLOR_GREEN_BORDER[1], COLOR_GREEN_BORDER[2]);
  doc.roundedRect(margin, y, halfW, 40, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_GREEN_TEXT[0], COLOR_GREEN_TEXT[1], COLOR_GREEN_TEXT[2]);
  doc.text("PAYMENT SETTLEMENT", margin + 6, y + 6.5);

  doc.setDrawColor(190, 225, 195);
  doc.line(margin + 6, y + 9, margin + halfW - 6, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);

  doc.text("INTEREST DUE:", margin + 6, y + 16);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.monthlyInterest, true), margin + 44, y + 16);

  doc.setFont("helvetica", "bold");
  doc.text("AMOUNT PAID:", margin + 6, y + 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(COLOR_GREEN_TEXT[0], COLOR_GREEN_TEXT[1], COLOR_GREEN_TEXT[2]);
  doc.text(formatMoney(data.amountPaid, true), margin + 44, y + 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text("PAYMENT DATE:", margin + 6, y + 30);
  doc.setFont("helvetica", "bold");
  doc.text(data.paymentDate || dateFormattedStr, margin + 44, y + 30);

  doc.text("STATUS:", margin + 6, y + 36);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLOR_GREEN_TEXT[0], COLOR_GREEN_TEXT[1], COLOR_GREEN_TEXT[2]);
  doc.text("CLEARED", margin + 44, y + 36);

  // CARD B: CURRENT LOAN POSITION (BALANCE SUMMARY)
  const cardBX = margin + halfW + 6;
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(cardBX, y, halfW, 40, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text("CURRENT LOAN POSITION", cardBX + 6, y + 6.5);

  doc.setDrawColor(228, 220, 195);
  doc.line(cardBX + 6, y + 9, cardBX + halfW - 6, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("PRINCIPAL OUTSTANDING", cardBX + 6, y + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
  doc.text(formatMoney(data.remainingPrincipal, true), cardBX + 6, y + 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("TOTAL SETTLED TODAY", cardBX + 6, y + 29);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text(`${formatMoney(data.amountPaid, true)} (Interest Only)`, cardBX + 6, y + 35);

  y += 48;

  // EXTENSION TIMELINE CARD (SPACIOUS NODE FLOW)
  checkPageBreak(38);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, "FD");

  renderCardTitle("Extension Timeline & Cycle Transition");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  const timeNodes = [
    { date: data.dateGiven || "Issued", title: "Loan Initiated" },
    { date: data.paymentDate || "Today", title: "Interest Paid" },
    { date: data.previousDueDate || "Prev Due", title: "Previous Cycle" },
    { date: data.newDueDate || "Next Due", title: "NEW DUE DATE", isGold: true },
  ];

  const timeY = y + 21;
  const nodeGap = (contentWidth - 24) / 3;

  doc.setDrawColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.setLineWidth(0.8);
  doc.line(margin + 12, timeY - 2.5, maxRightX - 12, timeY - 2.5);

  timeNodes.forEach((node, idx) => {
    const nodeX = margin + 12 + idx * nodeGap;

    doc.setFillColor(node.isGold ? COLOR_GOLD[0] : COLOR_NAVY[0], node.isGold ? COLOR_GOLD[1] : COLOR_NAVY[1], node.isGold ? COLOR_GOLD[2] : COLOR_NAVY[2]);
    doc.circle(nodeX, timeY - 2.5, 2.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(node.isGold ? COLOR_GOLD[0] : COLOR_NAVY[0], node.isGold ? COLOR_GOLD[1] : COLOR_NAVY[1], node.isGold ? COLOR_GOLD[2] : COLOR_NAVY[2]);
    doc.text(node.date, nodeX, timeY + 3.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(node.title, nodeX, timeY + 7.5, { align: "center" });
  });

  y += 40;

  // IMPORTANT FINANCIAL NOTICE BOX
  checkPageBreak(18);
  doc.setFillColor(254, 249, 235); // Soft Amber Fill
  doc.setDrawColor(240, 220, 160);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("IMPORTANT FINANCIAL NOTICE:", margin + 5, y + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
  doc.text("This document records interest settlement and cycle extension. Principal repayment is NOT included unless specifically noted.", margin + 5, y + 10);

  y += 24;

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 3: EXTENSION CONFIRMATION (THE 4 PILLARS) & THANK YOU
  // ═════════════════════════════════════════════════════════════════════════
  checkPageBreak(65);

  // EXTENSION CONFIRMATION CARD (SPACIOUS 2x2 WITH BADGES)
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 58, 2.5, 2.5, "FD");

  renderCardTitle("Loan Extension Confirmation & Terms");
  doc.setDrawColor(228, 220, 195);
  doc.line(margin + 6, y + 10, maxRightX - 6, y + 10);

  const pillars = [
    { badge: "(01)", title: "Interest Payment Received", desc: "Monthly interest for the current billing cycle has been fully received and verified." },
    { badge: "(02)", title: "Loan Remains Active", desc: "The principal balance remains outstanding and the loan continues as an active loan." },
    { badge: "(03)", title: "Repayment Period Extended", desc: `The billing cycle has been extended to the new due date: ${data.newDueDate}.` },
    { badge: "(04)", title: "Next Payment Reminder", desc: `The next interest payment is due on or before the new cycle due date: ${data.newDueDate}.` },
  ];

  let pStartY = y + 14;
  pillars.forEach((p, idx) => {
    const colX = idx % 2 === 0 ? margin + 6 : margin + 92;
    const rowPY = idx < 2 ? pStartY : pStartY + 20;

    // Number Badge Circle/Rounded Container
    doc.setFillColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.roundedRect(colX, rowPY, 8, 6, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_LIGHT_GOLD[0], COLOR_LIGHT_GOLD[1], COLOR_LIGHT_GOLD[2]);
    doc.text(p.badge.replace(/[()]/g, ""), colX + 4, rowPY + 4.2, { align: "center" });

    // Item Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]);
    doc.text(p.title, colX + 11, rowPY + 4.2);

    // Item Description
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2]);
    const lines = doc.splitTextToSize(p.desc, 72);
    let ly = rowPY + 9;
    lines.forEach((l: string) => {
      doc.text(l, colX + 11, ly);
      ly += 3.5;
    });
  });

  y += 68;

  // CENTERED THANK YOU SECTION (ELEGANT & INTENTIONAL)
  checkPageBreak(25);
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("THANK YOU", pageWidth / 2, y + 7, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text("Thank you for maintaining your payment schedule with FINEXA — Smart Loan Management System.", pageWidth / 2, y + 13, { align: "center" });

  // Render headers & footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderHeaderFooter(i, totalPages);
  }

  // Trigger Client-Side Download
  const filename = `FINEXA_Loan_Extension_${data.loanId}_${data.paymentDate || format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(filename);
}
