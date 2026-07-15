"use client";

import React, { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { submitLoanApplicationAction } from "../actions/submit-application.action";
import {
  FileText,
  User,
  Shield,
  CheckCircle,
  DollarSign,
  AlertCircle
} from "lucide-react";
import type { LoanApplication } from "@/db/schema";

interface BorrowerApplyFormProps {
  application: LoanApplication;
}

export function BorrowerApplyForm({ application }: BorrowerApplyFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  // Customer KYC Fields
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherMobile, setFatherMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");

  // Validation States
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Agreement Checkboxes
  const [confirmCorrect, setConfirmCorrect] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Real-time validations
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs.name = "Full Name is required";
    
    if (!mobile) {
      errs.mobile = "Mobile Number is required";
    } else if (!/^[6-9]\d{9}$/.test(mobile)) {
      errs.mobile = "Enter a valid 10-digit Indian mobile number starting with 6-9";
    }

    if (!fatherName.trim()) errs.fatherName = "Father's Name is required";

    if (!fatherMobile) {
      errs.fatherMobile = "Father's Mobile Number is required";
    } else if (!/^[6-9]\d{9}$/.test(fatherMobile)) {
      errs.fatherMobile = "Enter a valid 10-digit mobile number starting with 6-9";
    }

    if (!email) {
      errs.email = "Email Address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address";
    }

    if (!address.trim()) errs.address = "Full Address is required";

    if (!aadhaar) {
      errs.aadhaar = "Aadhaar Card Number is required";
    } else if (!/^\d{12}$/.test(aadhaar)) {
      errs.aadhaar = "Aadhaar Number must be exactly 12 digits";
    }

    if (!pan) {
      errs.pan = "PAN Card Number is required";
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())) {
      errs.pan = "Enter a valid PAN Card Number format (e.g. ABCDE1234F)";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please resolve validation errors before submitting.");
      return;
    }

    if (!confirmCorrect || !acceptTerms) {
      toast.error("You must check both agreement declarations to submit.");
      return;
    }

    // Capture offline state
    if (typeof window !== "undefined" && !navigator.onLine) {
      const queueItem = {
        id: Math.random().toString(36).substring(2, 9),
        type: "submit_application",
        data: {
          applicationCode: application.applicationCode,
          name,
          mobile,
          fatherName,
          fatherMobile,
          email,
          address,
          aadhaar,
          pan: pan.toUpperCase(),
          confirmCorrect: "true",
          acceptTerms: "true"
        }
      };

      const currentQueueRaw = localStorage.getItem("finexa_offline_sync_queue");
      const currentQueue = currentQueueRaw ? JSON.parse(currentQueueRaw) : [];
      currentQueue.push(queueItem);
      localStorage.setItem("finexa_offline_sync_queue", JSON.stringify(currentQueue));

      toast.success("Offline: Saved application details locally!", {
        description: "Your application will automatically sync when connection returns.",
        duration: 5000
      });
      setSubmitted(true);
      return;
    }

    const fd = new FormData();
    fd.append("applicationCode", application.applicationCode);
    fd.append("name", name);
    fd.append("mobile", mobile);
    fd.append("fatherName", fatherName);
    fd.append("fatherMobile", fatherMobile);
    fd.append("email", email);
    fd.append("address", address);
    fd.append("aadhaar", aadhaar);
    fd.append("pan", pan.toUpperCase());
    fd.append("confirmCorrect", confirmCorrect ? "true" : "false");
    fd.append("acceptTerms", acceptTerms ? "true" : "false");

    startTransition(async () => {
      const res = await submitLoanApplicationAction(null, fd);
      if (res.success) {
        setSubmitted(true);
        toast.success("Details submitted successfully!");
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to submit loan details.");
      }
    });
  };

  const inputClass = "h-12 bg-black/40 border-white/5 text-white rounded-xl placeholder:text-zinc-600 focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 text-sm px-4";
  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-zinc-400";
  const sectionHeaderClass = "flex items-center gap-2 border-b border-white/5 pb-3 mb-5";

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0B0B0F]">
        <div className="max-w-md w-full p-8 rounded-[20px] bg-[#17181D] border border-white/5 shadow-2xl text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle className="h-8 w-8" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-black text-white uppercase tracking-wider">Submitted Successfully</h1>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium">
              Your details have been submitted successfully. The Finexa team will contact you if any further verification is required.
            </p>
          </div>
          <div className="border-t border-white/5 pt-5 text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
            FINEXA SMART LOAN MANAGEMENT
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0B0B0F] py-12 px-4 flex flex-col items-center justify-start overflow-x-hidden relative">
      
      {/* Ambient background gold glow */}
      <div className="absolute top-10 left-[50%] -translate-x-1/2 w-[60vw] h-[60vw] bg-[#D4AF37]/5 rounded-full pointer-events-none z-0 blur-[120px]" />

      <div className="max-w-2xl w-full space-y-8 relative z-10">
        
        {/* 6. Customer Form Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img 
            src="/logo.png" 
            alt="Finexa Logo" 
            className="h-16 w-auto object-contain shadow-lg shadow-black/40"
          />
          <div>
            <h1 className="text-xl font-black tracking-wider text-white uppercase mt-2">
              FINEXA Smart Loan Management
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Please confirm pre-filled loan details and complete your KYC form.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* ─── SECTION 1: Read-only Loan Details ─── */}
          <div className="p-6 rounded-[20px] bg-[#17181D]/80 border border-white/5 shadow-xl space-y-4 text-left">
            <div className={sectionHeaderClass}>
              <DollarSign className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-xs font-bold text-white uppercase tracking-widest">Loan Information (Read-only)</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm bg-black/40 p-4 rounded-xl border border-white/5">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Loan Amount</span>
                <p className="text-base font-extrabold mt-0.5 text-white">₹{Number(application.principal).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Interest Amount</span>
                <p className="text-base font-extrabold mt-0.5 text-white">₹{Number(application.interestAmount).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Interest Type</span>
                <p className="text-sm font-semibold mt-0.5 capitalize text-white">{application.interestType} Interest</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Start Date</span>
                <p className="text-xs font-semibold mt-1 text-white">{application.startDate}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Due Date</span>
                <p className="text-xs font-semibold mt-1 text-white">{application.dueDate}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Duration</span>
                <p className="text-xs font-semibold mt-1 text-white">{application.loanDuration}</p>
              </div>
            </div>

            <div className="p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Total Amount Payable</span>
              <span className="text-lg font-black text-[#D4AF37]">
                ₹{(Number(application.principal) + Number(application.interestAmount)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* ─── SECTION 2: Customer Information (Mandatory) ─── */}
          <div className="p-6 rounded-[20px] bg-[#17181D]/80 border border-white/5 shadow-xl space-y-5 text-left">
            <div className={sectionHeaderClass}>
              <User className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-xs font-bold text-white uppercase tracking-widest">Customer Information</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="name" className={labelClass}>Full Name*</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ramesh Kumar"
                  className={inputClass}
                />
                {errors.name && <p className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.name}</p>}
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="mobile" className={labelClass}>Mobile Number*</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  placeholder="9876543210"
                  className={inputClass}
                />
                {errors.mobile && <p className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.mobile}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="fatherName" className={labelClass}>Father's Name*</Label>
                <Input
                  id="fatherName"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  required
                  placeholder="Suresh Kumar"
                  className={inputClass}
                />
                {errors.fatherName && <p className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.fatherName}</p>}
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="fatherMobile" className={labelClass}>Father's Mobile Number*</Label>
                <Input
                  id="fatherMobile"
                  type="tel"
                  value={fatherMobile}
                  onChange={(e) => setFatherMobile(e.target.value)}
                  required
                  placeholder="9876501234"
                  className={inputClass}
                />
                {errors.fatherMobile && <p className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.fatherMobile}</p>}
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label htmlFor="email" className={labelClass}>Email ID*</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ramesh@gmail.com"
                className={inputClass}
              />
              {errors.email && <p className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.email}</p>}
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label htmlFor="address" className={labelClass}>Address*</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="Flat 102, Building 4B, Sector 15, Gurugram, Haryana"
                className={inputClass}
              />
              {errors.address && <p className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.address}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="aadhaar" className={labelClass}>Aadhaar Number*</Label>
                <Input
                  id="aadhaar"
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value)}
                  required
                  placeholder="123456789012"
                  className={`${inputClass} font-mono`}
                />
                {errors.aadhaar && <p className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.aadhaar}</p>}
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="pan" className={labelClass}>PAN Number*</Label>
                <Input
                  id="pan"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  required
                  placeholder="ABCDE1234F"
                  className={`${inputClass} font-mono`}
                />
                {errors.pan && <p className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors.pan}</p>}
              </div>
            </div>
          </div>

          {/* ─── SECTION 3: Agreement ─── */}
          <div className="p-6 rounded-[20px] bg-[#17181D]/80 border border-white/5 shadow-xl space-y-4 text-left">
            <div className={sectionHeaderClass}>
              <Shield className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-xs font-bold text-white uppercase tracking-widest">Declaration & Terms</h2>
            </div>

            <div className="space-y-1">
              <span className={labelClass}>Finexa Terms & Conditions</span>
              <div className="h-32 overflow-y-auto border border-white/5 p-4 rounded-xl text-[10px] text-zinc-400 leading-relaxed bg-black/40 space-y-2">
                <p className="font-bold text-white">LOAN REPAYMENT AGREEMENT</p>
                <p>
                  1. Repayment obligation: The borrower agrees to repay the Principal Amount along with Interest (Total Amount Payable) on or before the Due Date.
                </p>
                <p>
                  2. Declarations: The borrower certifies that all information provided is true, accurate, and complete. Any misrepresentation constitutes defaults.
                </p>
                <p>
                  3. Consent: The customer consents to the secure encryption and storage of Aadhaar and PAN numbers in Finexa's database.
                </p>
              </div>
            </div>

            {/* Verification Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={confirmCorrect}
                  onChange={(e) => setConfirmCorrect(e.target.checked)}
                  className="mt-0.5 rounded border-white/5 accent-[#D4AF37] text-black bg-black/40 focus:ring-[#D4AF37]/20 h-3.5 w-3.5"
                />
                <span className="text-zinc-300 leading-normal text-xs">
                  I confirm that all the information provided is true and correct.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 rounded border-white/5 accent-[#D4AF37] text-black bg-black/40 focus:ring-[#D4AF37]/20 h-3.5 w-3.5"
                />
                <span className="text-zinc-300 leading-normal text-xs">
                  I agree to the Finexa Terms & Conditions.
                </span>
              </label>
            </div>
          </div>

          {/* Submit button (Gold) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#D4AF37] text-black font-black text-xs uppercase tracking-wider hover:bg-[#FFE082] transition-all shadow-lg shadow-[#D4AF37]/15 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
