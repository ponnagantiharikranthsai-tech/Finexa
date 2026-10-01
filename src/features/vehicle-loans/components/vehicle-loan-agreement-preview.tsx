"use client";

import React, { useState } from "react";
import { Printer, Download, FileText, CheckCircle2, ShieldAlert, Share2 } from "lucide-react";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";
import { generateVehicleLoanAgreementPdf } from "../utils/generate-vehicle-agreement-pdf";
import { ShareApplicationModal } from "./share-application-modal";
import { VehicleLoanPdfExportModal } from "./vehicle-loan-pdf-export-modal";
import { toast } from "sonner";

interface VehicleLoanAgreementPreviewProps {
  loan: VehicleCollateralLoanData;
}

export function VehicleLoanAgreementPreview({ loan }: VehicleLoanAgreementPreviewProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await generateVehicleLoanAgreementPdf(loan);
      toast.success("Loan Agreement PDF downloaded successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate PDF agreement");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border/60 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Printable Legal Loan Agreement</h4>
            <p className="text-[11px] text-muted-foreground">
              Dynamic variables inserted - Ready for stamp paper endorsement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Send to Borrower Button */}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Send to Borrower</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 bg-secondary hover:bg-accent text-xs font-medium text-foreground transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print View</span>
          </button>

          {/* PDF Types Dialog Trigger */}
          <button
            type="button"
            onClick={() => setPdfModalOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg fx-brand-gradient text-white text-xs font-bold shadow-sm fx-pressable"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export PDF Types</span>
          </button>
        </div>
      </div>

      <ShareApplicationModal
        loan={loan}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      <VehicleLoanPdfExportModal
        loan={loan}
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
      />

      {/* Printable Legal Agreement Paper */}
      <div className="rounded-2xl border border-border/60 bg-white dark:bg-card p-6 md:p-10 shadow-sm text-foreground print:shadow-none print:border-none print:p-0">
        
        {/* Stamp Paper Simulation Banner */}
        <div className="relative mb-8 p-4 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 text-center">
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
            [ NON-JUDICIAL E-STAMP PAPER ENDORSEMENT SPACE ]
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Government of Andhra Pradesh - Reg: Indian Stamp Act 1899 - Secured Micro-Credit Pledge
          </div>
        </div>

        {/* Agreement Header */}
        <div className="text-center pb-6 border-b border-border/60">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase mb-2">
            FINEXA DIGITAL FINANCE LEDGER
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase">
            VEHICLE COLLATERAL PLEDGE & EMERGENCY LOAN DEED
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mt-2">
            <span><strong>Agreement Code:</strong> {loan.applicationCode}</span>
            <span>•</span>
            <span><strong>Execution Date:</strong> {loan.startDate}</span>
            <span>•</span>
            <span><strong>Jurisdiction:</strong> Visakhapatnam, A.P.</span>
          </div>
        </div>

        {/* Preamble & Parties */}
        <div className="py-6 space-y-4 text-xs md:text-sm leading-relaxed text-foreground/90">
          <p>
            THIS AGREEMENT is made and entered into on this <strong>{loan.startDate}</strong>, by and between:
          </p>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
            <div>
              <span className="font-bold text-foreground">1. THE LENDER / FINANCIER: </span>
              <strong>{loan.lenderName}</strong>, Contact: <strong>{loan.lenderContact}</strong>, representing Finexa Micro-Credit Division (hereinafter referred to as the <em>&quot;Lender&quot;</em>, which expression shall include his legal heirs, executors, and assigns).
            </div>
            <div>
              <span className="font-bold text-foreground">2. THE BORROWER / PLEDGOR: </span>
              <strong>{loan.borrowerName}</strong>, Contact: <strong>{loan.borrowerContact}</strong>, Residing at: {loan.borrowerAddress} (hereinafter referred to as the <em>&quot;Borrower&quot;</em>).
            </div>
            <div>
              <span className="font-bold text-foreground">3. THE REGISTERED VEHICLE OWNER / GUARANTOR: </span>
              <strong>{loan.registeredOwner}</strong>, registered owner of the two-wheeler vehicle described below (hereinafter referred to as the <em>&quot;Vehicle Owner&quot;</em>).
            </div>
          </div>

          <p>
            WHEREAS the Borrower has requested an emergency micro-loan of <strong>₹{loan.principalAmount.toLocaleString("en-IN")}</strong> for <em>{loan.loanType}</em>, and has agreed to repay a total consolidated sum of <strong>₹{loan.totalAmountPayable.toLocaleString("en-IN")}</strong> within a period of <strong>{loan.loanDuration}</strong> on or before <strong>{loan.dueDate}</strong>.
          </p>

          <p>
            AND WHEREAS to secure prompt repayment of the aforesaid amount, the Borrower and the Registered Vehicle Owner have voluntarily surrendered and delivered <strong>PHYSICAL POSSESSION</strong> of the vehicle along with key and statutory documents into the custody of the Lender.
          </p>
        </div>

        {/* Schedule of Pledged Vehicle */}
        <div className="my-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
            SCHEDULE &apos;A&apos; — VEHICLE IDENTITY &amp; CUSTODY INVENTORY
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-muted/30 border border-border/50 text-xs">
            <div>
              <span className="text-muted-foreground">Vehicle Make &amp; Model:</span>
              <p className="font-bold text-foreground">{loan.vehicleMakeModel}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Registration Number:</span>
              <p className="font-bold text-foreground">{loan.vehicleRegNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Engine Number:</span>
              <p className="font-bold text-foreground">{loan.engineNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Chassis Number:</span>
              <p className="font-bold text-foreground">{loan.chassisNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Physical Custody Yard:</span>
              <p className="font-bold text-foreground">{loan.yardLocation}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Collateral Custody Status:</span>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">{loan.collateralStatus}</p>
            </div>
          </div>
        </div>

        {/* Documents Retained */}
        <div className="my-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
            SCHEDULE &apos;B&apos; — DOCUMENTS SURRENDERED &amp; DEPOSITED
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {loan.documentsCollected.map((doc, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{doc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terms & Default Conditions */}
        <div className="my-6 space-y-3 text-xs leading-relaxed text-foreground/85 border-t border-border/60 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
            TERMS, CONDITIONS &amp; DEFAULT RECOVERY POWERS
          </h3>
          <ol className="list-decimal list-inside space-y-2 pl-1">
            <li>
              <strong>Physical Yard Bailment:</strong> The vehicle shall remain strictly stationed within Finexa&apos;s secured yard compound. The Borrower shall have no right of access or operation until full clearance of ₹{loan.totalAmountPayable.toLocaleString("en-IN")}.
            </li>
            <li>
              <strong>Maturity &amp; Settlement:</strong> The full amount of <strong>₹{loan.totalAmountPayable.toLocaleString("en-IN")}</strong> is strictly due on <strong>{loan.dueDate}</strong>. Upon electronic verification of payment, the vehicle and all surrendered documents shall be released to the Borrower/Owner within 24 hours.
            </li>
            <li>
              <strong>Default Liquidation Clause:</strong> In the event of default or failure to pay the full sum on or before {loan.dueDate}, the Lender <strong>{loan.lenderName}</strong> is irrevocably authorized and empowered under signed RTO Forms 29 &amp; 30 to transfer ownership, encash deposited security cheques, or sell the vehicle at market valuation to liquidate the debt without further notice or court decree.
            </li>
          </ol>
        </div>

        {/* Dual Signature Blocks */}
        <div className="mt-8 pt-6 border-t border-border/60 grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center">
            <div className="h-16 w-full flex items-end justify-center pb-2 border-b border-border/80 font-serif italic text-sm text-foreground/70">
              {loan.lenderName}
            </div>
            <p className="mt-2 text-xs font-bold text-foreground">{loan.lenderName}</p>
            <p className="text-[10px] text-muted-foreground">Lender / Financier</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="h-16 w-full flex items-end justify-center pb-2 border-b border-border/80 font-serif italic text-sm text-foreground/70">
              {loan.borrowerName}
            </div>
            <p className="mt-2 text-xs font-bold text-foreground">{loan.borrowerName}</p>
            <p className="text-[10px] text-muted-foreground">Borrower / Pledgor</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="h-16 w-full flex items-end justify-center pb-2 border-b border-border/80 font-serif italic text-sm text-foreground/70">
              {loan.registeredOwner}
            </div>
            <p className="mt-2 text-xs font-bold text-foreground">{loan.registeredOwner}</p>
            <p className="text-[10px] text-muted-foreground">Registered Vehicle Owner</p>
          </div>
        </div>

        {/* Footer Audit Notice */}
        <div className="mt-8 pt-4 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Digital Ledger Record: {loan.applicationCode}</span>
          <span>Finexa Smart Collateral Engine v1.0</span>
        </div>
      </div>
    </div>
  );
}
