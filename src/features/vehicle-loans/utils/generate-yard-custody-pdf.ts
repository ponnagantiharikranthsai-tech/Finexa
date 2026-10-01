import { format } from "date-fns";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";

export async function generateYardCustodyPdf(loan: VehicleCollateralLoanData): Promise<void> {
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

  const COLOR_NAVY: [number, number, number] = [15, 23, 42];
  const COLOR_GOLD: [number, number, number] = [184, 134, 11];
  const COLOR_CARD_BG: [number, number, number] = [248, 250, 252];
  const COLOR_BORDER: [number, number, number] = [226, 232, 240];
  const COLOR_MUTED: [number, number, number] = [100, 116, 139];

  let y = 18;

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
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(margin, y + 23, contentWidth, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("FINEXA VEHICLE YARD & COMPOUND", margin + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(212, 168, 67);
  doc.text("PHYSICAL BAILMENT, CUSTODY VOUCHER & INVENTORY CERTIFICATE", margin + 6, y + 15);

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(maxRightX - 52, y + 4, 46, 15, 1.5, 1.5, "F");
  doc.setTextColor(184, 134, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CUSTODY VOUCHER", maxRightX - 49, y + 9);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(loan.applicationCode || "LN-2026-DIO35K", maxRightX - 49, y + 15);

  doc.restoreGraphicsState();
  y += 32;

  // Title
  doc.setTextColor(...COLOR_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("VEHICLE PHYSICAL POSSESSION & BAILMENT RECEIPT", pageWidth / 2, y, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Yard Check-in Date: ${formatDateClean(loan.yardInDate || loan.startDate)} | Yard Bay: #3 Secured Locker`, pageWidth / 2, y + 4.5, { align: "center" });

  y += 12;

  // Yard Specifications Card
  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GOLD);
  doc.text("VEHICLE IDENTIFICATION PARTICULARS", margin + 4, y + 6);

  const vDetails = [
    [
      { label: "Make & Model:", val: loan.vehicleMakeModel },
      { label: "Registration No:", val: loan.vehicleRegNumber },
    ],
    [
      { label: "Engine Number:", val: loan.engineNumber },
      { label: "Chassis Number:", val: loan.chassisNumber },
    ],
    [
      { label: "Registered Owner:", val: loan.registeredOwner },
      { label: "Pledgor / Borrower:", val: loan.borrowerName },
    ],
    [
      { label: "Odometer Reading:", val: `${loan.odometerReading || 14250} KM` },
      { label: "Ignition Key Status:", val: "Surrendered (1 Original Key)" },
    ],
  ];

  let vY = y + 12;
  vDetails.forEach((row) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(row[0].label, margin + 4, vY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(row[0].val, margin + 35, vY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_MUTED);
    doc.text(row[1].label, margin + 92, vY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(row[1].val, margin + 128, vY);

    vY += 6.5;
  });

  doc.restoreGraphicsState();
  y += 44;

  // Custody Conditions
  doc.saveGraphicsState();
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, y, contentWidth, 26, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("SAFE LOCKER & STATUTORY DOCUMENTS DEPOSITED", margin + 4, y + 6);

  loan.documentsCollected.forEach((d, idx) => {
    const dX = margin + 4 + (idx % 2 === 0 ? 0 : 88);
    const dY = y + 12 + (Math.floor(idx / 2) * 6.5);
    doc.setFillColor(34, 197, 94);
    doc.circle(dX + 1.5, dY - 1.2, 1.2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(d, dX + 5, dY);
  });

  doc.restoreGraphicsState();
  y += 32;

  // Release Protocol
  doc.saveGraphicsState();
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(margin, y, contentWidth, 20, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(67, 56, 202);
  doc.text("COLLATERAL RELEASE REQUIREMENTS:", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(49, 46, 129);
  doc.text(
    `This vehicle will be released solely upon receipt of full settlement payment of Rs. ${loan.totalAmountPayable.toLocaleString("en-IN")} on or before ${formatDateClean(loan.dueDate)}. Bring this original voucher and government photo ID.`,
    margin + 4,
    y + 11,
    { maxWidth: contentWidth - 8 }
  );
  doc.restoreGraphicsState();
  y += 26;

  // Signatures
  doc.saveGraphicsState();
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, "FD");

  const sW = contentWidth / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("YARD INVENTORY CUSTODIAN", margin + 4, y + 5);
  doc.line(margin + 4, y + 16, margin + sW - 10, y + 16);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(8);
  doc.text(loan.lenderName || "Hari Kranth Sai", margin + 4, y + 20);

  const s2X = margin + sW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("VEHICLE SURRENDER ACKNOWLEDGMENT (BORROWER)", s2X + 4, y + 5);
  doc.line(s2X + 4, y + 16, s2X + sW - 10, y + 16);
  doc.setTextColor(...COLOR_NAVY);
  doc.setFontSize(8);
  doc.text(loan.borrowerName || "Kuppili Abhilash", s2X + 4, y + 20);

  doc.restoreGraphicsState();

  const filename = `FINEXA_Yard_Custody_${loan.vehicleRegNumber}_${loan.applicationCode}.pdf`;
  doc.save(filename);
}
