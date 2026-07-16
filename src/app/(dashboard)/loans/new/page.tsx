"use client";

export const dynamic = "force-dynamic";

import React, { useState, useTransition, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { createLoanAction } from "@/features/loans/actions/create-loan.action";
import { lookupBorrowerAction, type BorrowerLookupResult } from "@/features/borrowers/actions/lookup-borrower.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { calculateDueDate } from "@/domain/due-date-calculator";
import { Search, Info, Check, ArrowLeft, User, FileText, Calculator, CreditCard } from "lucide-react";
import Link from "next/link";

export default function NewLoanPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState(createLoanAction, null);

  const [borrowerId, setBorrowerId]       = useState("");
  const [borrowerName, setBorrowerName]   = useState("");
  const [mobile, setMobile]               = useState("");
  const [email, setEmail]                 = useState("");
  const [pan, setPan]                     = useState("");
  const [aadhaar, setAadhaar]             = useState("");
  const [locationUrl, setLocationUrl]     = useState("");

  const [principal, setPrincipal]         = useState("10000");
  const [interestType, setInterestType]   = useState<"monthly" | "daily">("monthly");
  const [interestRate, setInterestRate]   = useState("20");
  const [dateGiven, setDateGiven]         = useState(new Date().toISOString().split("T")[0]!);

  const [matchedBorrower, setMatchedBorrower] = useState<BorrowerLookupResult | null>(null);

  // Live mobile lookup
  useEffect(() => {
    if (mobile.length === 10) {
      const handler = setTimeout(() => {
        startTransition(async () => {
          const res = await lookupBorrowerAction(mobile);
          if (res.success && res.data) setMatchedBorrower(res.data);
          else setMatchedBorrower(null);
        });
      }, 500);
      return () => clearTimeout(handler);
    }
  }, [mobile]);

  useEffect(() => {
    if (state?.success) {
      toast.success("Loan created successfully!");
      router.push("/loans");
      router.refresh();
    } else if (state && !state.success) {
      toast.error(typeof state.error === "string" ? state.error : "Validation errors found");
    }
  }, [state, router]);

  const selectMatchedBorrower = () => {
    if (!matchedBorrower) return;
    setBorrowerId(matchedBorrower.borrowerId);
    setBorrowerName(matchedBorrower.name);
    setMobile(matchedBorrower.mobile);
    setEmail(matchedBorrower.email || "");
    setLocationUrl(matchedBorrower.locationUrl || "");
    setPan("XXXXX1234X");
    setAadhaar("123456789012");
    setMatchedBorrower(null);
    toast.success(`Using existing borrower: ${matchedBorrower.name}`);
  };

  const clearBorrowerSelection = () => {
    setBorrowerId(""); setBorrowerName(""); setMobile(""); setEmail("");
    setPan(""); setAadhaar(""); setLocationUrl("");
  };

  // Calculator previews
  const numericPrincipal = Number(principal || 0);
  const numericRate      = Number(interestRate || 0);
  const monthlyInterest  = calculateMonthlyInterest(numericPrincipal, numericRate);
  const dailyInterest    = monthlyInterest / 30;
  const previewDueDate   = dateGiven ? calculateDueDate(new Date(dateGiven)) : new Date();
  const formattedDueDate = previewDueDate.toISOString().split("T")[0]!;
  const totalDue         = numericPrincipal + monthlyInterest;

  const inputClass = "h-11 rounded-xl border-border focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <Link href="/loans">
          <button className="flex items-center justify-center h-10 w-10 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">New Loan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Issue a loan and register borrower KYC.</p>
        </div>
      </div>

      {/* Existing borrower banner */}
      {matchedBorrower && (
        <div className="bg-accent dark:bg-secondary/80 border border-border dark:border-border/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3 text-foreground dark:text-primary/80">
            <Info className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Existing Borrower Found</p>
              <p className="text-xs mt-0.5">"{matchedBorrower.name}" is already in the system.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => setMatchedBorrower(null)}
              className="h-8 px-3 rounded-lg text-xs font-semibold border border-border dark:border-border text-primary dark:text-primary/80 hover:bg-accent dark:hover:bg-secondary transition-colors"
            >
              Ignore
            </button>
            <button
              type="button"
              onClick={selectMatchedBorrower}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/80 transition-colors"
            >
              <Check className="h-3.5 w-3.5" /> Use Existing
            </button>
          </div>
        </div>
      )}

      <form action={formAction} className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">

          {/* ── Section 1: Borrower Info ───────────────────────────────────── */}
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary dark:bg-secondary">
              <div className="h-7 w-7 rounded-lg bg-secondary dark:bg-secondary flex items-center justify-center">
                <User className="h-4 w-4 text-primary dark:text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Borrower Information</p>
                <p className="text-xs text-muted-foreground">KYC & identity for legal compliance</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <input type="hidden" name="borrowerId" value={borrowerId} />

              {borrowerId && (
                <div className="flex items-center justify-between bg-secondary dark:bg-secondary/80 border border-border dark:border-border p-3 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-primary dark:text-primary">Existing borrower locked</p>
                    <p className="text-xs text-primary/70 dark:text-primary">ID: {borrowerId}</p>
                  </div>
                  <button type="button" onClick={clearBorrowerSelection} className="text-xs font-semibold text-primary dark:text-primary hover:underline">
                    Change
                  </button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="borrowerName" className={labelClass}>Full Name*</Label>
                  <Input id="borrowerName" name="borrowerName" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} required disabled={!!borrowerId} placeholder="Ramesh Kumar" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mobile" className={labelClass}>Mobile*</Label>
                  <div className="relative">
                    <Input id="mobile" name="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} required disabled={!!borrowerId} placeholder="9876543210" className={inputClass} />
                    {isPending && mobile.length === 10 && (
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-pulse" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className={labelClass}>Email*</Label>
                  <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!borrowerId} placeholder="ramesh@gmail.com" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="locationUrl" className={labelClass}>Maps URL (optional)</Label>
                  <Input id="locationUrl" name="locationUrl" value={locationUrl} onChange={(e) => setLocationUrl(e.target.value)} disabled={!!borrowerId} placeholder="https://maps.google.com/..." className={inputClass} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pan" className={labelClass}>PAN Number*</Label>
                  <Input id="pan" name="pan" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} required disabled={!!borrowerId} placeholder="ABCDE1234F" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aadhaar" className={labelClass}>Aadhaar*</Label>
                  <Input id="aadhaar" name="aadhaar" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} required disabled={!!borrowerId} placeholder="123456789012" className={`${inputClass} font-mono`} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Loan Terms ──────────────────────────────────────── */}
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary dark:bg-secondary">
              <div className="h-7 w-7 rounded-lg bg-accent dark:bg-accent flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary dark:text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Loan Terms</p>
                <p className="text-xs text-muted-foreground">Principal, interest, and issue date</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="principal" className={labelClass}>Principal (₹)*</Label>
                  <Input id="principal" name="principal" type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} required className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dateGiven" className={labelClass}>Issue Date*</Label>
                  <Input id="dateGiven" name="dateGiven" type="date" value={dateGiven} onChange={(e) => setDateGiven(e.target.value)} required className={inputClass} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="interestRate" className={labelClass}>Rate (₹ per ₹1k / month)*</Label>
                  <Input id="interestRate" name="interestRate" type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="interestType" className={labelClass}>Period Type*</Label>
                  <Select value={interestType} onValueChange={(val: any) => setInterestType(val)}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="interestType" value={interestType} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Live Calculator Preview ─────────────────────────────── */}
        <div>
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden sticky top-5">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary dark:bg-secondary">
              <div className="h-7 w-7 rounded-lg bg-accent dark:bg-secondary flex items-center justify-center">
                <Calculator className="h-4 w-4 text-primary dark:text-primary" />
              </div>
              <p className="font-semibold text-sm">Live Preview</p>
            </div>

            <div className="p-5 space-y-3 text-sm">
              {[
                { label: "Principal",       value: `₹${numericPrincipal.toLocaleString("en-IN")}` },
                { label: "Monthly Interest", value: `₹${monthlyInterest.toLocaleString("en-IN")}`, gold: true },
                ...(interestType === "daily" ? [{ label: "Daily Interest", value: `₹${dailyInterest.toFixed(2)}` }] : []),
                { label: "Due Date",        value: formattedDueDate, gold: true },
              ].map(({ label, value, gold }) => (
                <div key={label} className="flex justify-between border-b border-border pb-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${gold ? "text-primary dark:text-primary" : ""}`}>{value}</span>
                </div>
              ))}

              <div className="flex justify-between items-center pt-1">
                <span className="font-bold">Total at Term</span>
                <span className="font-bold text-lg text-foreground">₹{totalDue.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="px-5 pb-5">
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl fx-brand-gradient text-white font-semibold text-sm shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed fx-pressable"
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create & Issue Loan"
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
