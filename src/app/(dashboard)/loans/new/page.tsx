"use client";

import React, { useState, useTransition, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createLoanAction } from "@/features/loans/actions/create-loan.action";
import { lookupBorrowerAction, type BorrowerLookupResult } from "@/features/borrowers/actions/lookup-borrower.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { calculateDueDate } from "@/domain/due-date-calculator";
import {
  Search,
  Check,
  ArrowLeft,
  User,
  CreditCard,
  Bell,
  Landmark,
  Plus,
  Calculator,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

import { useQueryClient } from "@tanstack/react-query";
import { LOANS_QUERY_KEY } from "@/features/loans/hooks/use-loan-management-data";
import {
  getFundersQuickListAction,
  type FunderQuickOption,
} from "@/features/capital/actions/get-funders-quick-list.action";
import { createFunderAction } from "@/features/capital/actions/create-funder.action";

export default function NewLoanPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-12 text-center text-sm text-muted-foreground">
          Loading loan creation workspace...
        </div>
      }
    >
      <NewLoanFormContent />
    </Suspense>
  );
}

function NewLoanFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Borrower state
  const [borrowerId, setBorrowerId]       = useState(searchParams.get("borrowerId") || "");
  const [borrowerName, setBorrowerName]   = useState(searchParams.get("name") || "");
  const [mobile, setMobile]               = useState(searchParams.get("mobile") || "");
  const [email, setEmail]                 = useState(searchParams.get("email") || "");
  const [pan, setPan]                     = useState(searchParams.get("pan") || "");
  const [aadhaar, setAadhaar]             = useState(searchParams.get("aadhaar") || "");
  const [locationUrl, setLocationUrl]     = useState("");

  // Loan state
  const [principal, setPrincipal]         = useState(searchParams.get("principal") || "10000");
  const [interestType, setInterestType]   = useState<"monthly" | "daily" | "weekly">("monthly");
  const [interestRate, setInterestRate]   = useState("20");
  const [dateGiven, setDateGiven]         = useState(new Date().toISOString().split("T")[0]!);
  const [dueDate, setDueDate]             = useState("");

  // On-Demand Capital Funding State
  const [funderId, setFunderId]           = useState("");
  const [fundingAmount, setFundingAmount] = useState(principal);
  const [fundingDate, setFundingDate]     = useState(new Date().toISOString().split("T")[0]!);
  const [fundingStatus, setFundingStatus] = useState<"allocated" | "received" | "pending">("allocated");
  const [fundersList, setFundersList]     = useState<FunderQuickOption[]>([]);

  // Inline "Add New Capital Person" Dialog
  const [showAddFunderModal, setShowAddFunderModal] = useState(false);
  const [newFunderName, setNewFunderName]           = useState("");
  const [newFunderMobile, setNewFunderMobile]       = useState("");
  const [newFunderNotes, setNewFunderNotes]         = useState("");
  const [isCreatingFunder, setIsCreatingFunder]     = useState(false);

  useEffect(() => {
    loadFunders();
  }, []);

  const loadFunders = async () => {
    const res = await getFundersQuickListAction();
    if (res.success && res.data) {
      setFundersList(res.data);
    }
  };

  // Keep funding amount in sync with principal if unchanged
  useEffect(() => {
    if (!funderId || fundingAmount === principal || !fundingAmount) {
      setFundingAmount(principal);
    }
  }, [principal]);

  // Prefetch loan management page
  useEffect(() => {
    router.prefetch("/loan-management");
  }, [router]);

  // Sync auto-calculated due date when dateGiven or interestType changes
  useEffect(() => {
    if (dateGiven) {
      const computedDue = calculateDueDate(new Date(dateGiven), interestType);
      setDueDate(computedDue.toISOString().split("T")[0]!);
    }
  }, [dateGiven, interestType]);

  const clearBorrowerSelection = () => {
    setBorrowerId(""); setBorrowerName(""); setMobile(""); setEmail("");
    setPan(""); setAadhaar(""); setLocationUrl("");
  };

  // Calculator previews
  const numericPrincipal = Number(principal || 0);
  const numericRate      = Number(interestRate || 0);
  const monthlyInterest  = calculateMonthlyInterest(numericPrincipal, numericRate);
  const weeklyInterest   = (numericPrincipal / 1000) * numericRate;
  const dailyInterest    = monthlyInterest / 30;
  const computedInterest = interestType === "weekly" ? weeklyInterest : interestType === "daily" ? dailyInterest * 30 : monthlyInterest;
  const formattedDueDate = dueDate || (dateGiven ? calculateDueDate(new Date(dateGiven), interestType).toISOString().split("T")[0]! : "");
  const totalDue         = numericPrincipal + computedInterest;

  // Handle Quick Create Capital Person
  const handleQuickCreateFunder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFunderName.trim() || !newFunderMobile.trim()) {
      toast.error("Please enter capital person name and mobile number.");
      return;
    }

    setIsCreatingFunder(true);
    try {
      const res = await createFunderAction({
        name: newFunderName.trim(),
        mobile: newFunderMobile.trim(),
        notes: newFunderNotes.trim() || null,
        fundingModel: "on_demand",
      });

      if (res.success && res.data) {
        const newFunder = res.data;

        // ── 1. Immediately inject the new person into the dropdown list ──────
        // This works even if the DB list-reload below fails (e.g. ECONNRESET).
        const newOption: FunderQuickOption = {
          funderId: newFunder.funderId,
          name: newFunder.name,
          mobile: newFunder.mobile,
          fundingModel: "on_demand",
          totalProvided: 0,
          currentlyAllocated: 0,
          unallocatedReceived: 0,
          totalCapital: 0,
          availableCapital: 0,
        };
        setFundersList((prev) => {
          // Avoid duplicates if the person already existed
          if (prev.some((f) => f.funderId === newFunder.funderId)) return prev;
          return [...prev, newOption].sort((a, b) => a.name.localeCompare(b.name));
        });

        // ── 2. Auto-select the newly created person ───────────────────────────
        setFunderId(newFunder.funderId);
        setFundingAmount(principal);
        setFundingDate(dateGiven || new Date().toISOString().split("T")[0]!);
        setShowAddFunderModal(false);
        setNewFunderName("");
        setNewFunderMobile("");
        setNewFunderNotes("");
        toast.success(res.message || `Capital person "${newFunder.name}" registered and selected!`);

        // ── 3. Refresh full list in background (ignore ECONNRESET silently) ──
        loadFunders().catch(() => { /* silent: list already has the new entry */ });
      } else {
        toast.error(res.error || "Failed to create capital person.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create capital person.");
    } finally {
      setIsCreatingFunder(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Client-side validation
    if (!borrowerId && (!borrowerName.trim() || !mobile.trim() || !email.trim() || !pan.trim() || !aadhaar.trim())) {
      toast.error("Please fill in all mandatory borrower fields.");
      return;
    }
    if (!principal || Number(principal) <= 0) {
      toast.error("Please enter a valid principal amount.");
      return;
    }

    setIsSubmitting(true);

    const numPrincipal = Number(principal);
    const resolvedDueDate = formattedDueDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]!;
    const tempLoanId = `temp_loan_${Date.now()}`;
    const tempBorrowerId = borrowerId || `temp_b_${Date.now()}`;

    // 1. Build FormData synchronously from component state
    const formData = new FormData();
    if (borrowerId) formData.append("borrowerId", borrowerId);
    formData.append("borrowerName", borrowerName);
    formData.append("mobile", mobile);
    formData.append("email", email);
    formData.append("pan", pan);
    formData.append("aadhaar", aadhaar);
    if (locationUrl) formData.append("locationUrl", locationUrl);
    formData.append("principal", principal);
    formData.append("interestType", interestType);
    formData.append("interestRate", interestRate);
    formData.append("dateGiven", dateGiven);
    formData.append("dueDate", resolvedDueDate);

    // On-Demand Capital Funding details
    if (funderId) {
      formData.append("funderId", funderId);
      formData.append("fundingAmount", fundingAmount || principal);
      formData.append("fundingDate", fundingDate || dateGiven);
      formData.append("fundingStatus", fundingStatus);
    }

    // 2. Construct instant optimistic loan matching LoanManagementDetailResult
    const optimisticLoan: any = {
      loanId: tempLoanId,
      borrowerId: tempBorrowerId,
      principal: principal,
      interestType: interestType,
      interestRate: interestRate,
      dateGiven: dateGiven,
      dueDate: resolvedDueDate,
      status: "active",
      penaltyType: "fixed",
      penaltyRate: "20",
      penaltyAmount: "0",
      internalNotes: null,
      internalNotesUpdatedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      borrower: {
        borrowerId: tempBorrowerId,
        name: borrowerName,
        mobile: mobile,
        email: email,
        panEncrypted: "",
        aadhaarEncrypted: "",
        panDecrypted: pan,
        aadhaarDecrypted: aadhaar,
        locationUrl: locationUrl || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      payments: [],
      cycles: [],
      reminders: [],
      outstandingBalance: numPrincipal,
      totalPaid: 0,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
      totalPenaltyPaid: 0,
      paidPeriods: 0,
      overdueDays: 0,
      accruedPenalty: 0,
      isDefaulted: false,
      calculatedStatus: "active",
      funding: funderId
        ? {
            totalFunded: Number(fundingAmount || principal),
            remainingRequired: Math.max(0, numPrincipal - Number(fundingAmount || principal)),
            isFullyFunded: Number(fundingAmount || principal) >= numPrincipal,
            isPartiallyFunded: Number(fundingAmount || principal) < numPrincipal,
            isUnfunded: false,
            sources: [
              {
                allocationId: `temp_alloc_${Date.now()}`,
                funderId,
                funderName: fundersList.find((f) => f.funderId === funderId)?.name || "Capital Person",
                funderMobile: fundersList.find((f) => f.funderId === funderId)?.mobile || "",
                amount: Number(fundingAmount || principal),
                funderSharePercentage: Math.round(
                  (Number(fundingAmount || principal) / numPrincipal) * 100
                ),
                allocationDate: fundingDate || dateGiven,
                notes: "On-demand funding",
              },
            ],
          }
        : {
            totalFunded: 0,
            remainingRequired: numPrincipal,
            isFullyFunded: false,
            isPartiallyFunded: false,
            isUnfunded: true,
            sources: [],
          },
      isOptimistic: true,
    };

    // 3. Call server action FIRST and await the result before navigating.
    //    Previously, router.push("/loan-management") fired on line 329 BEFORE
    //    createLoanAction completed on line 333. When Next.js navigated away it
    //    unmounted the component, aborting the in-flight server-action fetch.
    //    The catch block then labelled that abort as
    //    "Network error while saving loan. Rolled back." — even though the loan
    //    may or may not have been saved. Fix: await the server action first;
    //    only navigate after confirmed success.
    try {
      const res = await createLoanAction({ success: false, error: "" }, formData);

      if (res.success && res.data) {
        // Build real loan object, merging server data with local form values
        const realLoan: any = res.data.newLoan
          ? {
              ...res.data.newLoan,
              borrower: {
                ...res.data.newLoan.borrower,
                name: borrowerName || res.data.newLoan.borrower?.name,
                mobile: mobile || res.data.newLoan.borrower?.mobile,
                email: email || res.data.newLoan.borrower?.email,
                panDecrypted: pan || res.data.newLoan.borrower?.panDecrypted,
                aadhaarDecrypted: aadhaar || res.data.newLoan.borrower?.aadhaarDecrypted,
              },
              funding: optimisticLoan.funding,
              isOptimistic: false,
            }
          : { ...optimisticLoan, loanId: res.data.loanId, isOptimistic: false };

        // Update React Query cache with confirmed real loan
        queryClient.setQueryData<any[]>(LOANS_QUERY_KEY, (old) => {
          if (!old) return [realLoan];
          return [realLoan, ...old];
        });

        // Show success and navigate only after server confirms
        toast.success("Loan created successfully!");
        router.push("/loan-management");
      } else {
        // Server returned a validation or business error — stay on the form
        const err = !res.success ? res.error : undefined;
        const errText =
          typeof err === "string"
            ? err
            : Object.values(err || {}).flat().join("; ") || "Failed to create loan on server";
        toast.error(errText);
      }
    } catch (err: any) {
      toast.error("Failed to save loan. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "h-11 rounded-xl border-border focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <Link href="/loan-management">
          <button className="flex items-center justify-center h-10 w-10 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">New Loan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Issue a loan, assign on-demand funding, and register borrower KYC.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-3">
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

              {borrowerId ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    <span>Existing borrower selected: <strong>{borrowerName}</strong> ({mobile})</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearBorrowerSelection}
                    className="text-[11px] underline hover:opacity-80"
                  >
                    Change
                  </button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="borrowerName" className={labelClass}>Full Name*</Label>
                  <Input
                    id="borrowerName"
                    placeholder="Borrower name"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    required={!borrowerId}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mobile" className={labelClass}>Mobile Number*</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="10-digit mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required={!borrowerId}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="email" className={labelClass}>Email Address*</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required={!borrowerId}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pan" className={labelClass}>PAN Number*</Label>
                  <Input
                    id="pan"
                    placeholder="ABCDE1234F"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    required={!borrowerId}
                    className={`${inputClass} font-mono uppercase`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aadhaar" className={labelClass}>Aadhaar Number*</Label>
                  <Input
                    id="aadhaar"
                    placeholder="12-digit UID"
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    required={!borrowerId}
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="locationUrl" className={labelClass}>Google Maps Location URL (Optional)</Label>
                <Input
                  id="locationUrl"
                  type="url"
                  placeholder="https://maps.google.com/?q=..."
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Loan Financial Details ──────────────────────────── */}
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary dark:bg-secondary">
              <div className="h-7 w-7 rounded-lg bg-secondary dark:bg-secondary flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary dark:text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Loan Financial Terms</p>
                <p className="text-xs text-muted-foreground">Principal, interest rate, and schedule</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="principal" className={labelClass}>Principal Amount (₹)*</Label>
                  <Input
                    id="principal"
                    type="number"
                    placeholder="10000"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="interestRate" className={labelClass}>Interest Rate (₹ per ₹1K / Month)*</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.01"
                    placeholder="20"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className={labelClass}>Period Type*</Label>
                  <select
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value as any)}
                    className="w-full h-11 px-3 rounded-xl bg-background border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dateGiven" className={labelClass}>Date Given*</Label>
                  <Input
                    id="dateGiven"
                    type="date"
                    value={dateGiven}
                    onChange={(e) => setDateGiven(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dueDate" className={labelClass}>Due Date*</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Capital Source (On-Demand Model) ─────────────────── */}
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary dark:bg-secondary">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Landmark className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Capital Source</p>
                  <p className="text-[11px] text-muted-foreground">Select capital provider funding this loan on-demand, or allocate later</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddFunderModal(true)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/20 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Add New Capital Person
                </button>
                <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-bold">
                  OPTIONAL
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="funderId" className={labelClass}>Capital Provider / Funder</Label>
                <select
                  id="funderId"
                  value={funderId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFunderId(val);
                    if (val && (!fundingAmount || fundingAmount === "0")) {
                      setFundingAmount(principal);
                    }
                  }}
                  className="w-full h-11 px-3.5 rounded-xl bg-background border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- No Capital Person (Assign Later from Loan Card) --</option>
                  {fundersList.map((f) => (
                    <option key={f.funderId} value={f.funderId}>
                      {f.name} {f.unallocatedReceived > 0 ? `(Unallocated Received: ₹${f.unallocatedReceived.toLocaleString("en-IN")})` : `(On-Demand Provider)`}
                    </option>
                  ))}
                </select>
                {!funderId && (
                  <p className="text-[11px] text-muted-foreground">
                    No Capital Person — Assign Later from Loan Card
                  </p>
                )}
              </div>

              {funderId && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3 animate-in fade-in duration-200">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Capital Funding Amount (₹)*</Label>
                      <Input
                        type="number"
                        value={fundingAmount}
                        onChange={(e) => setFundingAmount(e.target.value)}
                        placeholder={principal}
                        className="h-10 rounded-xl bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Funding Date*</Label>
                      <Input
                        type="date"
                        value={fundingDate}
                        onChange={(e) => setFundingDate(e.target.value)}
                        className="h-10 rounded-xl bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Funding Status*</Label>
                      <select
                        value={fundingStatus}
                        onChange={(e) => setFundingStatus(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-xl bg-background border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="allocated">Allocated</option>
                        <option value="received">Received</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    On-Demand funding — record only the amount actually provided for this loan.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 4: Payment Reminders Schedule ─────────────────────── */}
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Payment Reminders</p>
                  <p className="text-[11px] text-muted-foreground">Admin reminders calculated relative to due date ({formattedDueDate || "N/A"})</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                AUTOMATIC
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { key: "10d", label: "10 Days Before", desc: "Inform borrower early" },
                  { key: "7d", label: "7 Days Before", desc: "Upcoming payment" },
                  { key: "3d", label: "3 Days Before", desc: "Follow up" },
                  { key: "1d", label: "1 Day Before", desc: "Final reminder" },
                  { key: "due_date", label: "Due Date", desc: "Payment due today" },
                  { key: "overdue", label: "Overdue Follow-up", desc: "Overdue follow-up" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-accent/20 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={true}
                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </label>
                ))}
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
                ...(interestType === "weekly"
                  ? [{ label: "Weekly Interest", value: `₹${weeklyInterest.toLocaleString("en-IN")}`, gold: true }]
                  : interestType === "daily"
                  ? [{ label: "Daily Interest", value: `₹${dailyInterest.toFixed(2)}` }, { label: "Est. Monthly (30 days)", value: `₹${monthlyInterest.toLocaleString("en-IN")}`, gold: true }]
                  : [{ label: "Monthly Interest", value: `₹${monthlyInterest.toLocaleString("en-IN")}`, gold: true }]
                ),
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
                disabled={isSubmitting || isPending}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl fx-brand-gradient text-white font-semibold text-sm shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed fx-pressable"
              >
                {isSubmitting || isPending ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating & Issuing...
                  </>
                ) : (
                  "Create & Issue Loan"
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ── Dialog: Quick Add New Capital Person ───────────────────────── */}
      <Dialog open={showAddFunderModal} onOpenChange={setShowAddFunderModal}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Capital Person
            </DialogTitle>
            <DialogDescription>
              Register a new on-demand capital provider. No permanent balance required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuickCreateFunder} className="space-y-4">
            <div className="space-y-1.5">
              <Label className={labelClass}>Name*</Label>
              <Input
                placeholder="e.g. X or Person Name"
                value={newFunderName}
                onChange={(e) => setNewFunderName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Phone Number*</Label>
              <Input
                type="tel"
                placeholder="10-digit mobile number"
                value={newFunderMobile}
                onChange={(e) => setNewFunderMobile(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Notes (Optional)</Label>
              <Input
                placeholder="e.g. On-demand emergency funder"
                value={newFunderNotes}
                onChange={(e) => setNewFunderNotes(e.target.value)}
                className={inputClass}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddFunderModal(false)}
                className="h-11 rounded-xl text-xs font-bold border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingFunder}
                className="h-11 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-cta-glow px-5"
              >
                {isCreatingFunder ? "Saving..." : "Add & Select"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
