import type { LoanManagementDetailResult } from "../actions/get-loan-management-data.action";
import { calculatePeriods, calculateMonthlyInterest } from "@/domain/interest-calculator";
import { calculateAccruedPenalty } from "@/domain/penalty-calculator";
import { differenceInDays, format } from "date-fns";

function getCardStatus(status: string, outstanding: number, dueDate: string) {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const today = new Date(todayStr);

  const isPaid = outstanding <= 0 || status === "closed";
  const isDueToday = dueDate === todayStr;
  const isOverdue = status === "overdue" || (new Date(dueDate) < today && !isPaid);

  if (isPaid) return "paid";
  if (isDueToday) return "due_today";
  if (isOverdue) return "overdue";
  return "active";
}

function getDurationText(dateGiven: string, dueDate: string, interestType: string) {
  try {
    const given = new Date(dateGiven);
    const due = new Date(dueDate);
    if (interestType === "daily") {
      const days = Math.max(1, differenceInDays(due, given));
      return `${days} Day${days !== 1 ? "s" : ""}`;
    } else {
      const months = Math.max(1, calculatePeriods(dateGiven, dueDate));
      return `${months} Month${months !== 1 ? "s" : ""}`;
    }
  } catch {
    return "N/A";
  }
}

export async function generateActiveLoansPdf(
  allLoans: LoanManagementDetailResult[],
  generatedByEmail?: string
): Promise<void> {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const today = new Date(todayStr);

  // 1. Filter ONLY ACTIVE loans using existing business logic
  const activeLoans = allLoans.filter((loan) => {
    const isPaid = loan.outstandingBalance <= 0 || loan.status === "closed";
    const isUnpaid = loan.outstandingBalance > 0 && loan.status !== "closed";
    return isUnpaid && (loan.status === "active" || loan.status === "extended" || loan.status === "overdue" || loan.status === "submitted");
  });

  if (activeLoans.length === 0) {
    throw new Error("No active loans available for backup.");
  }

  // Generate Unique Document Verification ID
  const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
  const docId = `FX-BACKUP-${format(new Date(), "yyyyMMdd")}-${randomHex}`;
  const timestampStr = format(new Date(), "dd MMMM yyyy, HH:mm:ss");

  // 2. Initialize jsPDF Document (A4 portrait: 210mm x 297mm)
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Calculate Financial Aggregates
  let totalPrincipalIssued = 0;
  let totalOutstandingPrincipal = 0;
  let totalAccruedPenalty = 0;
  let totalAmountPaid = 0;

  const processedCards = activeLoans.map((loan) => {
    const borrower = loan.borrower;
    const principal = Number(loan.principal || 0);
    const interestRate = Number(loan.interestRate || 0);
    const periods = Math.max(1, calculatePeriods(loan.dateGiven, loan.dueDate));
    const monthlyInt = calculateMonthlyInterest(principal, interestRate);
    const totalExpectedInt = periods * monthlyInt;

    const penaltyResult = calculateAccruedPenalty({
      principal,
      dueDate: loan.dueDate,
      status: loan.status,
      penaltyRate: Number((loan as any).penaltyRate || 20),
      manualPenaltyAmount: Number(loan.penaltyAmount || 0),
    });

    const accruedPenalty = penaltyResult.totalPenalty;
    const outstandingBal = Math.max(0, loan.outstandingBalance);
    const totalPayable = outstandingBal + accruedPenalty;
    const estimatedPaid = Math.max(0, (principal + totalExpectedInt) - outstandingBal);

    totalPrincipalIssued += principal;
    totalOutstandingPrincipal += outstandingBal;
    totalAccruedPenalty += accruedPenalty;
    totalAmountPaid += estimatedPaid;

    const dynamicStatus = getCardStatus(loan.status, outstandingBal, loan.dueDate);

    let statusLabel = "ACTIVE";
    let statusColorRGB = [212, 175, 55]; // Gold
    let statusBgRGB = [254, 243, 199]; // Light Gold

    if (dynamicStatus === "overdue") {
      statusLabel = "OVERDUE";
      statusColorRGB = [220, 38, 38]; // Red
      statusBgRGB = [254, 226, 226];
    } else if (dynamicStatus === "due_today") {
      statusLabel = "DUE TODAY";
      statusColorRGB = [37, 99, 235]; // Blue
      statusBgRGB = [219, 234, 254];
    } else if (loan.status === "extended") {
      statusLabel = "EXTENDED";
      statusColorRGB = [217, 119, 6]; // Amber
      statusBgRGB = [254, 235, 200];
    }

    return {
      loan,
      borrower,
      principal,
      interestRate,
      periods,
      monthlyInt,
      totalExpectedInt,
      accruedPenalty,
      outstandingBal,
      totalPayable,
      estimatedPaid,
      statusLabel,
      statusColorRGB,
      statusBgRGB,
      durationText: getDurationText(loan.dateGiven, loan.dueDate, loan.interestType),
    };
  });

  const grandTotalPayable = totalOutstandingPrincipal + totalAccruedPenalty;

  // ── PAGE 1 EXECUTIVE HEADER ───────────────────────────────────────────────
  doc.setFillColor(11, 15, 25); // Executive Onyx background
  doc.rect(0, 0, 210, 34, "F");

  doc.setFillColor(212, 175, 55); // Premium Gold Bar Accent
  doc.rect(0, 34, 210, 1.8, "F");

  // Logo Badge [ FX ]
  doc.setFillColor(212, 175, 55);
  doc.roundedRect(14, 8, 12, 12, 2, 2, "F");
  doc.setTextColor(11, 15, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FX", 17.2, 16);

  // Title Branding
  doc.setTextColor(255, 213, 74);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FINEXA", 30, 15);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(210, 220, 235);
  doc.text("FINANCIAL MANAGEMENT SYSTEM", 30, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(150, 165, 185);
  doc.text("OFFICIAL ACTIVE LOANS PORTFOLIO BACKUP RECORD", 30, 26);

  // Right Header Metadata Block
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("ACTIVE LOANS BACKUP", 196, 12, { align: "right" });

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 195, 215);
  doc.text(`Backup Date: ${format(new Date(), "dd MMMM yyyy")}`, 196, 17, { align: "right" });
  doc.text(`Doc ID: ${docId}`, 196, 22, { align: "right" });
  doc.text(`Total Active Loans: ${activeLoans.length}`, 196, 27, { align: "right" });

  let currentY = 40;

  // ── EXECUTIVE SUMMARY SECTION ─────────────────────────────────────────────
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("EXECUTIVE FINANCIAL OVERVIEW", 14, currentY);

  currentY += 4;

  const summaryCards = [
    { label: "ACTIVE LOANS", val: `${activeLoans.length}`, color: [212, 175, 55] },
    { label: "TOTAL ISSUED", val: `Rs. ${totalPrincipalIssued.toLocaleString("en-IN")}`, color: [30, 41, 59] },
    { label: "OUTSTANDING", val: `Rs. ${totalOutstandingPrincipal.toLocaleString("en-IN")}`, color: [220, 38, 38] },
    { label: "TOTAL PAYABLE", val: `Rs. ${grandTotalPayable.toLocaleString("en-IN")}`, color: [16, 185, 129] },
  ];

  const cardWidth = 43.5;
  const cardGap = 3.5;

  summaryCards.forEach((c, idx) => {
    const x = 14 + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, "FD");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, x + 4, currentY + 5.5);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(c.color[0]!, c.color[1]!, c.color[2]!);
    doc.text(c.val, x + 4, currentY + 12);
  });

  currentY += 22;

  // ── RENDER ACTIVE LOAN CARDS ──────────────────────────────────────────────
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("ACTIVE LOAN RECORDS BACKUP", 14, currentY);
  currentY += 4.5;

  processedCards.forEach((item, index) => {
    const loan = item.loan;
    const borrower = item.borrower;
    const notesText = (loan as any).internalNotes || (borrower as any).internalNotes || (loan as any).notes || "";

    // Wrap note lines for width = 170mm
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const noteLines: string[] = notesText ? doc.splitTextToSize(notesText, 170) : [];
    const noteBoxHeight = notesText ? Math.max(12, noteLines.length * 3.6 + 7) : 10;

    const totalCardHeight = 36 + noteBoxHeight;

    // Page Break Check: Ensure card is never split awkwardly across page breaks!
    if (currentY + totalCardHeight > 275) {
      doc.addPage();
      currentY = 18;
    }

    // Card Outer Header (Height: 8mm)
    doc.setFillColor(17, 24, 39);
    doc.roundedRect(14, currentY, 182, 8, 1.5, 1.5, "F");

    // Loan ID Title
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 213, 74);
    doc.text(`LOAN RECORD #${loan.loanId.toUpperCase()}  [Card ${index + 1} of ${processedCards.length}]`, 18, currentY + 5.5);

    // Status Pill Tag
    doc.setFillColor(item.statusBgRGB[0]!, item.statusBgRGB[1]!, item.statusBgRGB[2]!);
    doc.roundedRect(162, currentY + 1.8, 30, 4.5, 1, 1, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(item.statusColorRGB[0]!, item.statusColorRGB[1]!, item.statusColorRGB[2]!);
    doc.text(item.statusLabel, 177, currentY + 5, { align: "center" });

    currentY += 8;

    // Card Body Container Box
    const bodyStartY = currentY;
    const bodyHeight = 28 + noteBoxHeight;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 218, 230);
    doc.rect(14, bodyStartY, 182, bodyHeight, "S");

    // Column 1: Borrower Information (Width ~60mm)
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(140, 150, 165);
    doc.text("CUSTOMER IDENTITY", 18, currentY + 4);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(borrower.name || "N/A", 18, currentY + 8.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 80, 95);
    doc.text(`Mobile: ${borrower.mobile || "N/A"}`, 18, currentY + 12.5);
    if (borrower.fatherName) {
      doc.text(`Father: ${borrower.fatherName}`, 18, currentY + 16.5);
      doc.text(`Father Mob: ${borrower.fatherMobile || borrower.alternateMobile || "N/A"}`, 18, currentY + 20.5);
    } else {
      doc.text(`PAN: ${borrower.panDecrypted || "N/A"}`, 18, currentY + 16.5);
      doc.text(`Aadhaar: ${borrower.aadhaarDecrypted || "N/A"}`, 18, currentY + 20.5);
    }

    // Column 2: Loan Financial Terms (Width ~55mm)
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(140, 150, 165);
    doc.text("LOAN TERMS", 80, currentY + 4);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Rs. ${item.principal.toLocaleString("en-IN")}`, 80, currentY + 8.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 80, 95);
    doc.text(`Rate: ${loan.interestRate}% (${loan.interestType})`, 80, currentY + 12.5);
    doc.text(`Monthly Int: Rs. ${item.monthlyInt.toLocaleString("en-IN")}`, 80, currentY + 16.5);
    doc.text(`Duration: ${item.durationText}`, 80, currentY + 20.5);

    // Column 3: Dates & Balance Breakdown (Width ~55mm)
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(140, 150, 165);
    doc.text("BALANCE & STATUS", 140, currentY + 4);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 80, 95);
    doc.text(`Issue Date: ${loan.dateGiven || "N/A"}`, 140, currentY + 8.5);
    doc.text(`Due Date: ${loan.dueDate || "N/A"}`, 140, currentY + 12.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(`Outstanding: Rs. ${item.outstandingBal.toLocaleString("en-IN")}`, 140, currentY + 16.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(`Total Payable: Rs. ${item.totalPayable.toLocaleString("en-IN")}`, 140, currentY + 20.5);

    currentY += 22.5;

    // Divider line before Notes Box
    doc.setDrawColor(230, 235, 245);
    doc.line(18, currentY, 192, currentY);
    currentY += 1.5;

    // Note Section Box inside Card with Gold Left Accent Border!
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(18, currentY, 174, noteBoxHeight, "FD");

    // Gold Left Border Accent on Note Box
    doc.setFillColor(212, 175, 55);
    doc.rect(18, currentY, 1.8, noteBoxHeight, "F");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("INTERNAL NOTE:", 22, currentY + 3.8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    if (notesText) {
      let noteLineY = currentY + 7.5;
      noteLines.forEach((line) => {
        doc.text(line, 22, noteLineY);
        noteLineY += 3.6;
      });
    } else {
      doc.text("No additional remarks.", 22, currentY + 7.5);
    }

    currentY += noteBoxHeight + 5; // Spacing after card
  });

  // ── BACKUP VERIFICATION & SECURITY FOOTER BLOCK ───────────────────────────
  if (currentY + 30 > 275) {
    doc.addPage();
    currentY = 18;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(215, 222, 232);
  doc.roundedRect(14, currentY, 182, 26, 2, 2, "FD");

  // Left Gold Seal Line
  doc.setFillColor(212, 175, 55);
  doc.rect(14, currentY, 1.8, 26, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("BACKUP INFORMATION & AUDIT VERIFICATION", 18, currentY + 5.5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70, 80, 95);
  doc.text(`Document Type: Active Loans Backup Snapshot`, 18, currentY + 10.5);
  doc.text(`Data Source: FINEXA Loan Management System (Live Database)`, 18, currentY + 14.5);
  doc.text(`Generation Timestamp: ${timestampStr}`, 18, currentY + 18.5);
  if (generatedByEmail) {
    doc.text(`Generated By: ${generatedByEmail}`, 18, currentY + 22.5);
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55);
  doc.text(`Document ID: ${docId}`, 130, currentY + 10.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 110, 125);
  doc.text(`Total Records Backed Up: ${activeLoans.length} Active Loans`, 130, currentY + 14.5);
  doc.text(`Security Notice: Confidential - Restricted Administrative Record`, 130, currentY + 18.5);

  // ── FOOTERS ON EVERY PAGE ───────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer Divider Line
    doc.setDrawColor(220, 225, 235);
    doc.line(14, 285, 196, 285);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 130, 145);
    doc.text("FINEXA  |  Smart Loan Management System  |  Active Loans Backup Document", 14, 289);
    doc.text(`Page ${i} of ${totalPages}`, 196, 289, { align: "right" });
  }

  // ── AUTOMATIC DOWNLOAD ──────────────────────────────────────────────────────
  doc.save("FINEXA_Active_Loans_Report.pdf");
}
