"use client";

import React, { useState } from "react";
import { 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  Car, 
  CreditCard, 
  FileCheck2, 
  Eye, 
  ShieldCheck, 
  Building2,
  Calendar,
  Sparkles
} from "lucide-react";
import { DEFAULT_VEHICLE_LOAN, VehicleLoanFormData } from "../schemas/vehicle-loan.schema";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";
import { createVehicleLoanAction } from "../actions/vehicle-loan.actions";
import { VehicleLoanAgreementPreview } from "./vehicle-loan-agreement-preview";
import { toast } from "sonner";

interface VehicleLoanWizardFormProps {
  onSuccess?: (created: VehicleCollateralLoanData) => void;
  onCancel?: () => void;
}

const AVAILABLE_DOCS = [
  "Original Smart Card RC",
  "Signed RTO Form 29 & Form 30",
  "Signed Security Cheque(s)",
  "Vehicle Physical Inspection & Yard Handover Note",
  "Guarantor Authorization Letter (Golla Ramu)",
  "Borrower Aadhaar & PAN Copies",
];

export function VehicleLoanWizardForm({ onSuccess, onCancel }: VehicleLoanWizardFormProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<VehicleLoanFormData>(DEFAULT_VEHICLE_LOAN);

  const updateField = (field: keyof VehicleLoanFormData, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-compute interest/fee if principal or total payable changes
      if (field === "principalAmount" || field === "totalAmountPayable") {
        const principal = field === "principalAmount" ? Number(value) : prev.principalAmount;
        const total = field === "totalAmountPayable" ? Number(value) : prev.totalAmountPayable;
        next.interestOrFee = Math.max(0, total - principal);
      }
      return next;
    });
  };

  const toggleDocument = (doc: string) => {
    setFormData((prev) => {
      const exists = prev.documentsCollected.includes(doc);
      return {
        ...prev,
        documentsCollected: exists
          ? prev.documentsCollected.filter((d) => d !== doc)
          : [...prev.documentsCollected, doc],
      };
    });
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.borrowerName || !formData.principalAmount || !formData.totalAmountPayable) {
        toast.error("Please fill in all mandatory loan terms.");
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.vehicleRegNumber || !formData.vehicleMakeModel || !formData.registeredOwner) {
        toast.error("Please fill in vehicle details.");
        return;
      }
    } else if (currentStep === 3) {
      if (formData.documentsCollected.length === 0) {
        toast.error("Please select at least one document collected.");
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await createVehicleLoanAction(formData as any);
      if (res.success && res.data) {
        toast.success(`Vehicle Loan ${res.data.applicationCode} saved to digital ledger!`);
        if (onSuccess) onSuccess(res.data);
      } else {
        toast.error(res.error || "Failed to save vehicle loan");
      }
    } catch (err: any) {
      toast.error("Failed to commit loan to database");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: "Loan & Parties", icon: CreditCard },
    { num: 2, title: "Vehicle Collateral", icon: Car },
    { num: 3, title: "Documents & Yard", icon: FileCheck2 },
    { num: 4, title: "Agreement & Submit", icon: Eye },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Wizard Step Progress Header */}
      <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setCurrentStep(step.num)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isCompleted
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:bg-accent/40"
                }`}
              >
                <div
                  className={`flex items-center justify-center h-6 w-6 rounded-lg ${
                    isCurrent
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 1: Loan & Party Terms */}
      {currentStep === 1 && (
        <div className="p-6 rounded-2xl bg-card border border-border/60 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div>
              <h3 className="text-base font-bold text-foreground">Step 1: Party Details & Loan Terms</h3>
              <p className="text-xs text-muted-foreground">
                Micro-loan parameters, emergency purpose justification, and financial breakdown
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Pre-Filled Default Data</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Application Code */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Digital Application Code</label>
              <input
                type="text"
                value={formData.applicationCode}
                onChange={(e) => updateField("applicationCode", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Loan Purpose / Type */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Loan Type & Purpose</label>
              <input
                type="text"
                value={formData.loanType}
                onChange={(e) => updateField("loanType", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Principal Amount */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Principal Disbursed (₹)</label>
              <div className="relative mt-1">
                <span className="absolute left-3.5 top-2.5 text-xs text-muted-foreground font-bold">₹</span>
                <input
                  type="number"
                  value={formData.principalAmount}
                  onChange={(e) => updateField("principalAmount", Number(e.target.value))}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Total Amount Payable */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Total Repayable / Settlement (₹)</label>
              <div className="relative mt-1">
                <span className="absolute left-3.5 top-2.5 text-xs text-primary font-bold">₹</span>
                <input
                  type="number"
                  value={formData.totalAmountPayable}
                  onChange={(e) => updateField("totalAmountPayable", Number(e.target.value))}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-primary/40 bg-primary/5 text-xs font-black text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Interest / Facility Fee: ₹{formData.interestOrFee.toLocaleString("en-IN")}
              </p>
            </div>

            {/* Loan Duration */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Loan Duration</label>
              <input
                type="text"
                value={formData.loanDuration}
                onChange={(e) => updateField("loanDuration", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Maturity / Settlement Due Date</label>
              <div className="relative mt-1">
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => updateField("dueDate", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-red-500/40 bg-background text-xs font-bold text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/40"
                />
              </div>
            </div>

            {/* Lender Name */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Lender Name</label>
              <input
                type="text"
                value={formData.lenderName}
                onChange={(e) => updateField("lenderName", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Lender Contact */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Lender Contact Phone</label>
              <input
                type="text"
                value={formData.lenderContact}
                onChange={(e) => updateField("lenderContact", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Borrower Name */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Borrower Name (Pledgor)</label>
              <input
                type="text"
                value={formData.borrowerName}
                onChange={(e) => updateField("borrowerName", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Borrower Contact */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Borrower Mobile Number</label>
              <input
                type="text"
                value={formData.borrowerContact}
                onChange={(e) => updateField("borrowerContact", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Vehicle & Collateral Verification */}
      {currentStep === 2 && (
        <div className="p-6 rounded-2xl bg-card border border-border/60 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div>
              <h3 className="text-base font-bold text-foreground">Step 2: Vehicle & Collateral Identity</h3>
              <p className="text-xs text-muted-foreground">
                Two-wheeler make, registration, engine/chassis authentication, and ownership details
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
              <Car className="h-3.5 w-3.5" />
              <span>AP39QY9367 (Honda Dio)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Registered Vehicle Owner */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Registered Vehicle Owner (RC Name)</label>
              <input
                type="text"
                value={formData.registeredOwner}
                onChange={(e) => updateField("registeredOwner", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Guarantor / 3rd Party Owner</p>
            </div>

            {/* Vehicle Make & Model */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Vehicle Make & Model</label>
              <input
                type="text"
                value={formData.vehicleMakeModel}
                onChange={(e) => updateField("vehicleMakeModel", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Registration Number */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Vehicle Registration Number</label>
              <input
                type="text"
                value={formData.vehicleRegNumber}
                onChange={(e) => updateField("vehicleRegNumber", e.target.value.toUpperCase())}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20 text-xs font-mono font-black text-amber-700 dark:text-amber-400 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            {/* Engine Number */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Engine Number</label>
              <input
                type="text"
                value={formData.engineNumber}
                onChange={(e) => updateField("engineNumber", e.target.value.toUpperCase())}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Chassis Number */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Chassis Number</label>
              <input
                type="text"
                value={formData.chassisNumber}
                onChange={(e) => updateField("chassisNumber", e.target.value.toUpperCase())}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Odometer Reading */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Odometer Reading (KM)</label>
              <input
                type="number"
                value={formData.odometerReading}
                onChange={(e) => updateField("odometerReading", Number(e.target.value))}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Documents Checklist & Yard Custody */}
      {currentStep === 3 && (
        <div className="p-6 rounded-2xl bg-card border border-border/60 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div>
              <h3 className="text-base font-bold text-foreground">Step 3: Custody Status & Documents Retained</h3>
              <p className="text-xs text-muted-foreground">
                Physical yard bailment location and statutory transfer documents retained in safe locker
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Physical Yard Possession</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Collateral Status */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Collateral Custody Status</label>
              <input
                type="text"
                value={formData.collateralStatus}
                onChange={(e) => updateField("collateralStatus", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-muted/30 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Yard Location */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Yard / Garage Storage Location</label>
              <input
                type="text"
                value={formData.yardLocation}
                onChange={(e) => updateField("yardLocation", e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Documents Checklist Multi-Select */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-foreground">
              Statutory Documents Collected &amp; Verified
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AVAILABLE_DOCS.map((doc) => {
                const checked = formData.documentsCollected.includes(doc);
                return (
                  <button
                    key={doc}
                    type="button"
                    onClick={() => toggleDocument(doc)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                      checked
                        ? "bg-primary/10 border-primary/40 text-foreground"
                        : "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center h-5 w-5 rounded-md border ${
                        checked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border/80 bg-background"
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <span>{doc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Preview Agreement & Commit to Digital Ledger */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-card border border-border/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Step 4: Digital Agreement Verification</h3>
              <p className="text-xs text-muted-foreground">
                All parameters dynamically injected into the legal agreement deed below.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 h-10 px-5 rounded-xl fx-brand-gradient text-white text-xs font-bold shadow-md fx-cta-glow fx-pressable disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? "Committing..." : "Commit to Supabase Ledger"}</span>
            </button>
          </div>

          {/* Embedded Full Agreement Preview */}
          <VehicleLoanAgreementPreview loan={formData as any} />
        </div>
      )}

      {/* Bottom Step Navigation Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/60">
        <button
          type="button"
          onClick={currentStep === 1 ? onCancel : handleBack}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border/60 bg-secondary hover:bg-accent text-xs font-semibold text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{currentStep === 1 ? "Cancel" : "Previous Step"}</span>
        </button>

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 h-9 px-5 rounded-xl fx-brand-gradient text-white text-xs font-bold shadow-sm fx-pressable"
          >
            <span>Next: {steps[currentStep].title}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 h-9 px-6 rounded-xl fx-brand-gradient text-white text-xs font-bold shadow-md fx-cta-glow fx-pressable disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSubmitting ? "Saving..." : "Save & Register Loan"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
