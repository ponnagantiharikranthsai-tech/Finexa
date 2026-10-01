"use client";

import React, { useState, useTransition } from "react";
import { 
  Car, 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  User, 
  Phone, 
  Home, 
  CreditCard, 
  Calendar, 
  Check, 
  Lock, 
  Download,
  Clock
} from "lucide-react";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";
import { submitVehicleBorrowerApplicationAction } from "../actions/submit-vehicle-borrower-application.action";
import { generateVehicleLoanAgreementPdf } from "../utils/generate-vehicle-agreement-pdf";
import { toast } from "sonner";

interface BorrowerVehicleApplyFormProps {
  loan: VehicleCollateralLoanData;
}

export function BorrowerVehicleApplyForm({ loan }: BorrowerVehicleApplyFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState<boolean>(false);

  // KYC Fields prefilled for Kuppili Abhilash
  const [fullName, setFullName] = useState<string>(loan.borrowerName || "Kuppili Abhilash");
  const [mobile, setMobile] = useState<string>(loan.borrowerContact || "9876543210");
  const [fatherName, setFatherName] = useState<string>("Kuppili Satyanarayana");
  const [fatherContact, setFatherContact] = useState<string>("9440123456");
  const [address, setAddress] = useState<string>(loan.borrowerAddress || "H.No 4-12, Gajuwaka Main Road, Visakhapatnam, Andhra Pradesh - 530026");
  const [aadhaarNumber, setAadhaarNumber] = useState<string>("7845 9210 3341");
  const [panNumber, setPanNumber] = useState<string>("ABCPA1234K");
  const [hospitalPurposeNote, setHospitalPurposeNote] = useState<string>("Emergency Hospital Treatment / Medical Expenses at Apollo Hospital Visakhapatnam");

  // Legal Consent Checkboxes
  const [confirmVehicleCustody, setConfirmVehicleCustody] = useState<boolean>(true);
  const [confirmDocsHandover, setConfirmDocsHandover] = useState<boolean>(true);
  const [acceptLegalTerms, setAcceptLegalTerms] = useState<boolean>(false);
  const [signatureName, setSignatureName] = useState<string>(loan.borrowerName || "Kuppili Abhilash");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !mobile.trim()) {
      toast.error("Please enter your full name and contact number.");
      return;
    }
    if (!confirmVehicleCustody || !confirmDocsHandover) {
      toast.error("You must confirm vehicle physical possession and document surrender.");
      return;
    }
    if (!acceptLegalTerms) {
      toast.error("You must accept the legal pledge and default liquidation terms.");
      return;
    }
    if (!signatureName.trim()) {
      toast.error("Please provide your digital e-signature.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitVehicleBorrowerApplicationAction({
          applicationCode: loan.applicationCode,
          borrowerName: fullName,
          borrowerContact: mobile,
          borrowerAddress: address,
          fatherName,
          fatherContact,
          aadhaarNumber,
          panNumber,
          hospitalPurposeNote,
          termsAccepted: acceptLegalTerms,
          custodyConfirmed: confirmVehicleCustody,
          signatureName,
        });

        if (res.success) {
          setSubmitted(true);
          toast.success("Application successfully submitted and e-signed!");
        } else {
          toast.error(res.error || "Submission failed. Please try again.");
        }
      } catch (err: any) {
        toast.error("Error submitting application");
      }
    });
  };

  const handleDownloadPdf = async () => {
    try {
      await generateVehicleLoanAgreementPdf({
        ...loan,
        borrowerName: fullName,
        borrowerContact: mobile,
        borrowerAddress: address,
      });
      toast.success("Loan Agreement PDF downloaded!");
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-lg w-full p-8 rounded-3xl bg-card border border-border/60 shadow-xl text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono">
              {loan.applicationCode}
            </span>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Application &amp; Pledge E-Signed!
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
              Thank you, <strong>{fullName}</strong>. Your vehicle collateral loan application for <strong>{loan.vehicleMakeModel} ({loan.vehicleRegNumber})</strong> has been recorded in the FINEXA secure digital ledger.
            </p>
          </div>

          {/* Key Loan Recap */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Principal Disbursed:</span>
              <span className="font-bold text-foreground">₹{loan.principalAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Repayable:</span>
              <span className="font-bold text-primary text-sm">₹{loan.totalAmountPayable.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Settlement Due Date:</span>
              <span className="font-bold text-destructive">{loan.dueDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle Custody:</span>
              <span className="font-semibold text-foreground">{loan.yardLocation}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lender Contact:</span>
              <span className="font-semibold text-foreground">{loan.lenderName} ({loan.lenderContact})</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="w-full flex items-center justify-center gap-2 h-11 px-5 rounded-xl fx-brand-gradient text-white text-xs font-bold shadow-md fx-cta-glow fx-pressable"
            >
              <Download className="h-4 w-4" />
              <span>Download E-Signed Agreement PDF</span>
            </button>
            <p className="text-[11px] text-muted-foreground">
              Bring this confirmation upon settlement on or before {loan.dueDate} to release your vehicle from the yard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    FINEXA MICRO-FINANCE
                  </span>
                  <h1 className="text-xl font-black tracking-tight text-foreground">
                    Vehicle Collateral Loan Application
                  </h1>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Emergency &amp; Hospital Medical Assistance Financing backed by Vehicle Pledge
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono font-bold">
                {loan.applicationCode}
              </span>
              <p className="text-[11px] text-muted-foreground mt-1">
                Lender: <strong>{loan.lenderName}</strong>
              </p>
            </div>
          </div>

          {/* Quick Highlight Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 pt-4 border-t border-border/40 text-xs">
            <div className="p-2.5 rounded-xl bg-muted/30">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Principal Disbursed</span>
              <p className="text-base font-bold text-foreground">₹{loan.principalAmount.toLocaleString("en-IN")}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-[10px] text-primary uppercase font-semibold">Total Payable</span>
              <p className="text-base font-black text-primary">₹{loan.totalAmountPayable.toLocaleString("en-IN")}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/30">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Loan Duration</span>
              <p className="text-base font-bold text-foreground">{loan.loanDuration}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
              <span className="text-[10px] text-destructive uppercase font-semibold">Due Date</span>
              <p className="text-base font-bold text-destructive">{loan.dueDate}</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Pledged Vehicle Confirmation */}
          <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/40">
              <Car className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                1. Vehicle Collateral &amp; Custody Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Vehicle Make &amp; Model</span>
                <p className="font-bold text-foreground">{loan.vehicleMakeModel}</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Registration Number</span>
                <p className="font-mono text-base font-black text-amber-800 dark:text-amber-300">{loan.vehicleRegNumber}</p>
              </div>

              <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Registered Owner (RC)</span>
                <p className="font-bold text-foreground">{loan.registeredOwner}</p>
              </div>

              <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Engine &amp; Chassis No</span>
                <p className="font-mono text-[11px] text-foreground">Eng: {loan.engineNumber}</p>
                <p className="font-mono text-[11px] text-foreground">Chas: {loan.chassisNumber}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Yard Storage Location:</span>
              <span className="font-semibold text-foreground">{loan.yardLocation}</span>
            </div>
          </div>

          {/* Section 2: Borrower Identity & KYC */}
          <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/40">
              <User className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                2. Borrower KYC &amp; Verification Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Borrower Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Mobile Number (WhatsApp Enabled)</label>
                <input
                  type="text"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Father&apos;s / Guardian&apos;s Name</label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Father&apos;s / Alternate Contact Number</label>
                <input
                  type="text"
                  value={fatherContact}
                  onChange={(e) => setFatherContact(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Aadhaar Card Number</label>
                <input
                  type="text"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">PAN Number</label>
                <input
                  type="text"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Residential Address</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Hospital / Medical Emergency Note</label>
                <textarea
                  rows={2}
                  value={hospitalPurposeNote}
                  onChange={(e) => setHospitalPurposeNote(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Custody & Statutory Document Confirmation */}
          <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/40">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                3. Physical Custody &amp; Document Surrender Checklist
              </h2>
            </div>

            <div className="space-y-3">
              <label
                onClick={() => setConfirmVehicleCustody(!confirmVehicleCustody)}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border/40 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div
                  className={`mt-0.5 flex items-center justify-center h-5 w-5 rounded-md border shrink-0 ${
                    confirmVehicleCustody
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border/80 bg-background"
                  }`}
                >
                  {confirmVehicleCustody && <Check className="h-3.5 w-3.5" />}
                </div>
                <div className="text-xs leading-relaxed text-foreground">
                  <strong>Vehicle Physical Bailment Confirmation:</strong> I confirm that two-wheeler <strong>{loan.vehicleMakeModel} (Reg: {loan.vehicleRegNumber})</strong> along with ignition keys has been voluntarily delivered and parked in the secured physical custody of <strong>{loan.lenderName}</strong> at <em>{loan.yardLocation}</em>.
                </div>
              </label>

              <label
                onClick={() => setConfirmDocsHandover(!confirmDocsHandover)}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border/40 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div
                  className={`mt-0.5 flex items-center justify-center h-5 w-5 rounded-md border shrink-0 ${
                    confirmDocsHandover
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border/80 bg-background"
                  }`}
                >
                  {confirmDocsHandover && <Check className="h-3.5 w-3.5" />}
                </div>
                <div className="text-xs leading-relaxed text-foreground">
                  <strong>Original Documents Handover:</strong> I acknowledge surrendering the <strong>Original Smart Card RC</strong>, <strong>Signed RTO Form 29 &amp; 30</strong>, and <strong>Signed Security Cheque(s)</strong> into the safe custody of the lender.
                </div>
              </label>
            </div>
          </div>

          {/* Section 4: Legal Undertaking & E-Signature */}
          <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/40">
              <FileText className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                4. Legal Undertaking &amp; Digital Signature
              </h2>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs leading-relaxed text-foreground space-y-2">
              <p>
                <strong>DEFAULT &amp; LIQUIDATION AUTHORIZATION:</strong> I, <strong>{fullName}</strong>, hereby covenant and promise to repay the entire consolidated sum of <strong>₹{loan.totalAmountPayable.toLocaleString("en-IN")}</strong> to <strong>{loan.lenderName}</strong> on or before <strong>{loan.dueDate}</strong>.
              </p>
              <p className="text-muted-foreground text-[11px]">
                In the event of failure to pay the full sum on or before the due date ({loan.dueDate}), I unconditionally empower and authorize the Lender to present the security cheques, enforce signed RTO Forms 29 &amp; 30, and liquidate or sell the vehicle AP39QY9367 to recover the outstanding balance.
              </p>
            </div>

            <label
              onClick={() => setAcceptLegalTerms(!acceptLegalTerms)}
              className="flex items-start gap-3 p-3.5 rounded-2xl bg-card border border-primary/40 cursor-pointer hover:bg-primary/5 transition-colors"
            >
              <div
                className={`mt-0.5 flex items-center justify-center h-5 w-5 rounded-md border shrink-0 ${
                  acceptLegalTerms
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border/80 bg-background"
                }`}
              >
                {acceptLegalTerms && <Check className="h-3.5 w-3.5" />}
              </div>
              <div className="text-xs font-semibold text-foreground">
                I have read, understood, and accept all the terms, conditions, and default liquidation clauses of this Vehicle Collateral Pledge.
              </div>
            </label>

            <div className="pt-2">
              <label className="text-xs font-semibold text-muted-foreground">Digital Signature (Type your Full Name)</label>
              <input
                type="text"
                required
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl border border-border/60 bg-muted/20 font-serif italic text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                E-Sign Timestamp will be cryptographically logged upon submission.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending || !acceptLegalTerms}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl fx-brand-gradient text-white text-sm font-bold shadow-lg fx-cta-glow fx-pressable disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="h-4 w-4" />
              <span>{isPending ? "Submitting & Registering..." : "Submit & E-Sign Vehicle Loan Agreement"}</span>
            </button>
            <p className="text-[11px] text-center text-muted-foreground mt-2">
              Powered by Finexa Smart Secured Lending Infrastructure
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
