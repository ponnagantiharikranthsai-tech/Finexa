"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users, CreditCard, Landmark, ShieldAlert, History, Send, FileText,
  Trash2, Plus, ExternalLink, RefreshCw, Eye, EyeOff, Edit, MapPin,
  Clock, AlertTriangle, Check, CheckCircle2, XCircle, Settings, X
} from "lucide-react";
import { useExtraLoanDetails, useInvalidateLoanDetails } from "../../hooks/use-extra-loan-details";
import { LOANS_QUERY_KEY } from "../../hooks/use-loan-management-data";
import { calculateAccruedPenalty } from "@/domain/penalty-calculator";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { deletePaymentAction } from "@/features/payments/actions/delete-payment.action";
import { saveInternalNotesAction } from "@/features/borrowers/actions/save-internal-notes.action";
import { updatePenaltySettingsAction } from "../../actions/update-penalty-settings.action";
import { removeCapitalAllocationAction } from "@/features/capital/actions/remove-capital-allocation.action";
import type { LoanManagementDetailResult } from "../../actions/get-loan-management-data.action";
import { differenceInDays } from "date-fns";

export interface DetailedAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanManagementDetailResult | null;
  onEditKyc: (loan: LoanManagementDetailResult) => void;
  onAllocateCapital: (loan: LoanManagementDetailResult) => void;
  onDeleteBorrower: (borrowerId: string, borrowerName: string) => void;
  isDeletingBorrower?: boolean;
}

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

function StatusBadge({ status, outstanding, dueDate }: { status: string; outstanding: number; dueDate: string }) {
  const dynamicStatus = getCardStatus(status, outstanding, dueDate);

  const config = {
    active: {
      badge: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 shadow-sm shadow-yellow-500/5",
      label: "ACTIVE",
      icon: <Clock size={10} />,
    },
    due_today: {
      badge: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
      label: "DUE TODAY",
      icon: <Clock size={10} className="animate-pulse" />,
    },
    overdue: {
      badge: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
      label: "OVERDUE",
      icon: <AlertTriangle size={10} />,
    },
    paid: {
      badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
      label: "SETTLED",
      icon: <Check size={10} />,
    },
  }[dynamicStatus];

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider flex items-center gap-1 ${config.badge}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

function getInterestAmount(loan: LoanManagementDetailResult): number {
  if (loan.interestType === "monthly") {
    return calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate));
  }
  return 0;
}

function getDuration(dateGiven: string, dueDate: string, interestType: string) {
  const start = new Date(dateGiven);
  const end = new Date(dueDate);
  const diffDays = differenceInDays(end, start);
  if (interestType === "monthly") {
    const months = Math.round(diffDays / 30);
    return `${months} Mo${months !== 1 ? "s" : ""} (${diffDays} Days)`;
  }
  return `${diffDays} Day${diffDays !== 1 ? "s" : ""}`;
}

export function DetailedAuditModal({
  open,
  onOpenChange,
  loan,
  onEditKyc,
  onAllocateCapital,
  onDeleteBorrower,
  isDeletingBorrower = false,
}: DetailedAuditModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateDetails = useInvalidateLoanDetails();

  const [showSensitive, setShowSensitive] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [penaltyRateInput, setPenaltyRateInput] = useState("20");
  const [isUpdatingPenalty, setIsUpdatingPenalty] = useState(false);

  // TanStack Query with 5-minute staleTime for instant 0ms access
  const { extraDetails, penaltyLedger, isLoading: detailsLoading } = useExtraLoanDetails(open && loan ? loan.loanId : null);

  useEffect(() => {
    if (loan) {
      const existingNotes =
        (loan as any).internalNotes !== undefined && (loan as any).internalNotes !== null
          ? (loan as any).internalNotes
          : (loan.borrower as any).internalNotes || "";
      setNotesText(existingNotes);
      setPenaltyRateInput(((loan as any).penaltyRate || 20).toString());
      setShowSensitive(false);
    }
  }, [loan]);

  if (!loan) return null;

  const currentFunding = extraDetails?.funding || loan.funding;
  const sources = currentFunding?.sources || [];
  const totalFunded = currentFunding?.totalFunded || 0;
  const principal = Number(loan.principal);
  const remainingFunded = Math.max(0, principal - totalFunded);

  const currentRate = Number(penaltyRateInput);
  const penaltyInfo = calculateAccruedPenalty({
    principal: Number(loan.principal),
    dueDate: loan.dueDate,
    status: loan.status,
    penaltyRate: isNaN(currentRate) || currentRate < 0 ? Number((loan as any).penaltyRate || 20) : currentRate,
    manualPenaltyAmount: Number(loan.penaltyAmount || 0),
  });
  const totalInterest = getInterestAmount(loan);
  const totalPayable = Number(loan.principal) + totalInterest + penaltyInfo.totalPenalty;

  const penaltyColorClass =
    penaltyInfo.totalPenalty === 0
      ? "text-emerald-400 font-bold text-sm"
      : penaltyInfo.totalPenalty < 1000
      ? "text-amber-400 font-extrabold text-sm"
      : "text-red-400 font-black text-base";

  const handleSaveNotes = async (text: string) => {
    try {
      const res = await saveInternalNotesAction(loan.borrowerId, text);
      if (res.success) {
        toast.success("Internal notes saved successfully.");
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        invalidateDetails(loan.loanId);
      } else {
        toast.error("Failed to save internal notes.");
      }
    } catch {
      toast.error("Failed to save internal notes.");
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this payment record? This will adjust outstanding balance.")) return;
    try {
      const res = await deletePaymentAction(paymentId, loan.loanId);
      if (res.success) {
        toast.success("Payment deleted successfully.");
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        invalidateDetails(loan.loanId);
      } else {
        toast.error("Failed to delete payment.");
      }
    } catch {
      toast.error("Failed to delete payment.");
    }
  };

  const handleRemoveAllocation = async (allocationId: string) => {
    if (!confirm("Are you sure you want to remove this capital allocation?")) return;
    try {
      const res = await removeCapitalAllocationAction(allocationId);
      if (res.success) {
        toast.success("Capital allocation removed successfully.");
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        invalidateDetails(loan.loanId);
      } else {
        toast.error("Failed to remove capital allocation.");
      }
    } catch {
      toast.error("Failed to remove capital allocation.");
    }
  };

  const handleUpdatePenaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(penaltyRateInput);
    if (isNaN(rate) || rate < 0) {
      toast.error("Please enter a valid penalty rate.");
      return;
    }
    setIsUpdatingPenalty(true);
    try {
      const res = await updatePenaltySettingsAction(loan.loanId, rate);
      if (res.success) {
        toast.success(`Penalty rate updated to ₹${rate} per ₹1,000/day.`);
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        invalidateDetails(loan.loanId);
      } else {
        toast.error("Failed to update penalty rate.");
      }
    } catch {
      toast.error("Failed to update penalty rate.");
    } finally {
      setIsUpdatingPenalty(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 border-0 bg-transparent shadow-none max-w-5xl w-full"
        style={{ maxWidth: "64rem" }}
        showCloseButton={false}
      >
        <div className="flex flex-col max-h-[85vh] bg-[#121215]/95 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl text-zinc-100">
          {/* STICKY HEADER */}
          <div className="shrink-0 px-6 py-4 border-b border-zinc-800/80 bg-[#121215] flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center gap-3">
                <span>Detailed Audit File</span>
                <StatusBadge
                  status={loan.status}
                  outstanding={loan.outstandingBalance}
                  dueDate={loan.dueDate}
                />
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-1">
                Verify KYC, loan limits, payment logs, and reminder dispatch audit trail.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ── Two-Column Split Dashboard (Top Section) ─────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Borrower Information */}
              <div className="bg-[#18181b] p-5 rounded-xl border border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-700/60 pb-3">
                  <h3 className="font-bold text-xs tracking-wider uppercase text-amber-400 flex items-center gap-2">
                    <Users className="h-4 w-4" /> 👤 BORROWER INFORMATION
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSensitive(!showSensitive)}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                    >
                      {showSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showSensitive ? "Hide IDs" : "Reveal IDs"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        onEditKyc(loan);
                      }}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold hover:bg-yellow-500/20 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>Edit KYC</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Full Name</span>
                    <p className="text-sm font-semibold text-zinc-100 mt-1">{loan.borrower.name}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Father&apos;s Name</span>
                    <p className="text-sm font-semibold text-zinc-100 mt-1">{loan.borrower.fatherName || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Mobile Number</span>
                    <p className="text-sm font-semibold text-zinc-100 mt-1">{loan.borrower.mobile}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Father&apos;s Mobile</span>
                    <p className="text-sm font-semibold text-zinc-100 mt-1">{loan.borrower.fatherMobile || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Email Address</span>
                    <p className="text-sm font-semibold text-zinc-100 mt-1 break-all">{loan.borrower.email || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Address</span>
                    <p className="text-sm font-semibold text-zinc-100 mt-1 break-words leading-relaxed">{loan.borrower.address || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">PAN Number</span>
                    <p className="text-sm font-mono font-semibold text-zinc-100 mt-1">
                      {showSensitive
                        ? (extraDetails?.panDecrypted || loan.borrower.panDecrypted)
                        : (loan.borrower.panDecrypted ? `•••••${loan.borrower.panDecrypted.slice(-5)}` : "N/A")}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Aadhaar Number</span>
                    <p className="text-sm font-mono font-semibold text-zinc-100 mt-1">
                      {showSensitive
                        ? (extraDetails?.aadhaarDecrypted || loan.borrower.aadhaarDecrypted)
                        : (loan.borrower.aadhaarDecrypted ? `••••••••${loan.borrower.aadhaarDecrypted.slice(-4)}` : "N/A")}
                    </p>
                  </div>
                  {loan.borrower.locationUrl && (
                    <div className="col-span-2 pt-1 border-t border-zinc-700/50">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-yellow-400" /> Location Coordinates
                      </span>
                      <a
                        href={loan.borrower.locationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-yellow-400 hover:text-yellow-300 hover:underline font-semibold text-xs inline-block mt-1"
                      >
                        Open Maps Geolocation Coordinates ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Loan Portfolio & Payment History */}
              <div className="bg-[#18181b] p-5 rounded-xl border border-zinc-800/80 space-y-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-700/60 pb-3 mb-4">
                    <h3 className="font-bold text-xs tracking-wider uppercase text-amber-400 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> 📊 LOAN PORTFOLIO DETAILS
                    </h3>
                  </div>

                  {/* Section A: Loan Metrics grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-left">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Principal</span>
                      <p className="text-sm font-mono font-bold text-yellow-500 mt-1">₹{Number(loan.principal).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Interest</span>
                      <p className="text-sm font-mono font-bold text-yellow-500 mt-1">₹{totalInterest.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Type</span>
                      <p className="text-sm font-semibold text-zinc-100 mt-1 capitalize">{loan.interestType}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Duration</span>
                      <p className="text-sm font-semibold text-zinc-100 mt-1">
                        {getDuration(loan.dateGiven, loan.dueDate, loan.interestType)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Start Date</span>
                      <p className="text-sm font-semibold text-zinc-100 mt-1">{loan.dateGiven}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Due Date</span>
                      <p className="text-sm font-semibold text-zinc-100 mt-1">{loan.dueDate}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Amount Paid</span>
                      <p className="text-sm font-mono font-bold text-emerald-400 mt-1">
                        ₹{(Number(loan.principal) + totalInterest + Number(loan.penaltyAmount || 0) - loan.outstandingBalance).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Remaining</span>
                      <p className="text-sm font-mono font-bold text-yellow-500 mt-1">
                        ₹{loan.outstandingBalance.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section B: Recent Transaction & Audit Logs */}
                <div className="border-t border-zinc-700/60 pt-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-amber-400" /> Recent Repayment & Audit Logs
                    </h4>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {extraDetails?.payments.length || 0} recorded
                    </span>
                  </div>

                  {detailsLoading ? (
                    <p className="text-xs text-zinc-400 py-3 flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3 animate-spin text-amber-400" /> Loading payment records...
                    </p>
                  ) : !extraDetails || extraDetails.payments.length === 0 ? (
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400 text-center">
                      No payment records found for this loan file.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {extraDetails.payments.map((p) => (
                        <div key={p.paymentId} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{p.paymentType}</span>
                              <span className="text-[11px] text-zinc-400">{p.paymentDate}</span>
                            </div>
                            {p.notes && <p className="text-[11px] text-zinc-400 truncate mt-0.5">{p.notes}</p>}
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <span className="font-bold text-xs text-emerald-400">+₹{Number(p.amount).toLocaleString("en-IN")}</span>
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p.paymentId)}
                              className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 p-1 rounded transition-colors"
                              title="Delete Payment Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 2A: Capital & Funding Allocation ───────────────── */}
            <div className="bg-[#18181b] p-5 rounded-xl border border-zinc-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-700/60 pb-3">
                <h3 className="font-bold text-xs tracking-wider uppercase text-amber-400 flex items-center gap-2">
                  <Landmark className="h-4 w-4" /> 🏦 CAPITAL & FUNDING SOURCES
                </h3>
                <div className="flex items-center gap-2">
                  {currentFunding?.isFullyFunded ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Fully Funded
                    </span>
                  ) : currentFunding?.isPartiallyFunded ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Partially Funded (₹{remainingFunded.toLocaleString("en-IN")} left)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Not Assigned
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onAllocateCapital(loan);
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 transition-all flex items-center gap-1.5 shadow-sm shadow-yellow-500/5"
                  >
                    <Plus size={14} /> Add Capital Person
                  </button>
                </div>
              </div>

              {/* 2. Unified Financial Metric Cards (Principal, Funded, Balance) */}
              <div className="grid grid-cols-3 gap-4 bg-[#141418] p-4 rounded-xl border border-zinc-800/80">
                <div>
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Loan Principal</span>
                  <div className="text-base font-mono font-bold text-yellow-500 mt-0.5">₹{principal.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Total Funded</span>
                  <div className="text-base font-mono font-bold text-yellow-500 mt-0.5">₹{totalFunded.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Unfunded Balance</span>
                  <div className="text-base font-mono font-bold text-zinc-400 mt-0.5">₹{remainingFunded.toLocaleString("en-IN")}</div>
                </div>
              </div>

              {/* Sources Table */}
              {sources.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-zinc-900/50 border border-zinc-800/70 text-xs text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-300">No capital person assigned yet</p>
                  <p className="text-[11px]">Click &quot;+ Add Capital Person&quot; above to connect an investor/funder to this loan.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-900/60">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-white/[0.02]">
                        <th className="p-3 font-bold text-zinc-400 uppercase text-[10px] tracking-wider">Capital Person</th>
                        <th className="p-3 font-bold text-zinc-400 uppercase text-[10px] tracking-wider">Amount</th>
                        <th className="p-3 font-bold text-zinc-400 uppercase text-[10px] tracking-wider">Share %</th>
                        <th className="p-3 font-bold text-zinc-400 uppercase text-[10px] tracking-wider">Funding Date</th>
                        <th className="p-3 font-bold text-zinc-400 uppercase text-[10px] tracking-wider">Notes</th>
                        <th className="p-3 font-bold text-zinc-400 uppercase text-[10px] tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {sources.map((src) => (
                        <tr key={src.allocationId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3">
                            <p className="font-bold text-zinc-100">{src.funderName}</p>
                            <p className="text-[10px] text-zinc-400">{src.funderMobile}</p>
                          </td>
                          <td className="p-3 font-bold font-mono text-yellow-500 text-sm">
                            ₹{src.amount.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 font-semibold text-zinc-200">
                            {src.funderSharePercentage}%
                          </td>
                          <td className="p-3 text-zinc-400 text-[11px]">
                            {src.allocationDate}
                          </td>
                          <td className="p-3 text-zinc-400 text-[11px] truncate max-w-[140px]" title={src.notes || ""}>
                            {src.notes || "—"}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenChange(false);
                                  router.push(`/capital-management/${src.funderId}`);
                                }}
                                className="px-3 py-1 rounded-lg text-xs text-zinc-300 bg-zinc-800/60 border border-zinc-700/60 hover:border-yellow-500/40 hover:text-yellow-400 transition flex items-center gap-1"
                                title="View in Capital Management"
                              >
                                Capital Details <ExternalLink size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAllocation(src.allocationId)}
                                className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Remove Allocation"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Section 2B: Penalty Details & Settings ───────────────── */}
            <div className="bg-[#18181b] p-5 rounded-xl border border-zinc-800/80 space-y-4">
              <h3 className="font-bold text-xs tracking-wider uppercase text-amber-400 flex items-center gap-2 border-b border-zinc-700/60 pb-3">
                <ShieldAlert className="h-4 w-4 text-red-400" /> ⚠️ PENALTY DETAILS & SETTINGS
              </h3>

              {/* Penalty Details Card */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 shadow-lg space-y-3.5 text-left">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Principal Amount</p>
                    <p className="font-bold font-mono text-yellow-500 text-sm mt-0.5">
                      ₹{Number(loan.principal).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Penalty Rate</p>
                    <p className="font-semibold text-amber-400 text-xs mt-0.5">
                      ₹{penaltyInfo.penaltyRatePerThousand} / ₹1,000 / Day
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Overdue Days</p>
                    <p className={`font-bold text-xs mt-0.5 ${penaltyInfo.daysOverdue > 0 ? "text-red-400" : "text-zinc-200"}`}>
                      {penaltyInfo.daysOverdue > 0 ? `${penaltyInfo.daysOverdue} Days` : "No Penalty (0 Days)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Daily Penalty</p>
                    <p className="font-semibold text-zinc-200 text-xs mt-0.5">
                      ₹{penaltyInfo.dailyPenalty.toLocaleString("en-IN")}/day
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Total Accrued Penalty</p>
                    <p className={`mt-0.5 font-mono ${penaltyColorClass}`}>
                      ₹{penaltyInfo.totalPenalty.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Total Amount Payable</p>
                    <p className="font-bold font-mono text-yellow-500 text-base mt-0.5">
                      ₹{totalPayable.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Penalty Rate Real-time Admin Configurator */}
              <form onSubmit={handleUpdatePenaltySettings} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                    <Settings className="h-3.5 w-3.5 text-amber-400" /> Edit Penalty Rate (₹ per ₹1,000 / Day)
                  </h4>
                  <span className="text-[10px] text-zinc-400">Real-time Calculation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                      Penalty Rate (₹ per ₹1,000 / Day)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={penaltyRateInput}
                      onChange={(e) => setPenaltyRateInput(e.target.value)}
                      placeholder="e.g. 5, 10, 15, 20, 50"
                      className="h-10 rounded-xl text-xs bg-zinc-800 border-zinc-700 text-white font-bold placeholder:text-zinc-500 focus:ring-amber-500 focus:border-amber-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingPenalty}
                    className="h-10 px-4 rounded-xl text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 transition-all shadow-sm shadow-yellow-500/5 disabled:opacity-50"
                  >
                    {isUpdatingPenalty ? "Saving..." : "Save Penalty Rate"}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Formula: Penalty = (Principal ÷ 1,000) × Penalty Rate × Overdue Days
                </p>
              </form>

              {/* Penalty Ledger Audit Log */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-amber-400" /> Penalty Audit Ledger
                </h4>
                {penaltyLedger.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-1">No historical penalty changes logged yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {penaltyLedger.map((row) => (
                      <div key={row.ledgerId} className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-zinc-100">{row.remarks || "Penalty Updated"}</p>
                          <p className="text-[10px] text-zinc-400">
                            {row.calculationDate} • {row.adminName || "Admin"} • {row.daysOverdue} Days Overdue
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-red-400 text-xs">₹{Number(row.penaltyAdded).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Sub-Grid: Notifications Dispatch Log & Permanent Loan Cycle History ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Notifications Dispatch */}
              <div className="bg-[#27272a] p-5 rounded-xl border border-zinc-800/80 space-y-3.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400 border-b border-zinc-700/60 pb-2.5 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-amber-400" /> Notifications Dispatch Log
                </h4>
                {detailsLoading ? (
                  <p className="text-xs text-zinc-400 py-4 flex items-center gap-1.5"><RefreshCw className="h-3 w-3 animate-spin text-amber-400" /> Loading alert logs...</p>
                ) : !extraDetails || extraDetails.notifications.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4">No alert logs recorded for this loan file.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {extraDetails.notifications.map((n) => (
                      <div key={n.notificationId} className="flex items-start justify-between p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-semibold capitalize text-zinc-100">{n.type} <span className="text-[10px] text-zinc-400">via {n.channel}</span></p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{new Date(n.sentAt).toLocaleString()}</p>
                          {n.errorMessage && <p className="text-[10px] text-red-400 mt-0.5">{n.errorMessage}</p>}
                        </div>
                        <div className="ml-2 shrink-0">
                          {n.status === "sent" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Permanent Loan Cycle History */}
              <div className="bg-[#18181b] p-5 rounded-xl border border-zinc-800/80 space-y-3.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400 border-b border-zinc-700/60 pb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-amber-400" /> Loan Cycle History
                  </span>
                  <span className="text-[10px] text-zinc-400 font-normal lowercase">Recorded cycles</span>
                </h4>
                {detailsLoading ? (
                  <p className="text-xs text-zinc-400 py-4 flex items-center gap-1.5"><RefreshCw className="h-3 w-3 animate-spin text-amber-400" /> Loading cycle history...</p>
                ) : !extraDetails || !extraDetails.cycles || extraDetails.cycles.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-3">No historical cycle extensions logged yet for this loan file.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {extraDetails.cycles.map((c) => (
                      <div key={c.cycleId} className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-100">Cycle #{c.cycleNumber}</span>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              c.cycleStatus === "paid" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              c.cycleStatus === "overdue_closed" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                              c.cycleStatus === "extended" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                              "bg-zinc-800 text-amber-400 border border-zinc-700"
                            }`}>
                              {c.cycleStatus.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-1">
                            Due: {c.originalDueDate} {c.actualPaymentDate ? "· Cleared: " + c.actualPaymentDate : ""} · Principal: ₹{Number(c.remainingPrincipal).toLocaleString("en-IN")}
                          </p>
                          {c.notes && <p className="text-[10px] text-zinc-400 mt-0.5 italic">{c.notes}</p>}
                        </div>
                        <div className="text-right sm:shrink-0">
                          <p className="font-bold font-mono text-xs text-yellow-500">Interest Paid: ₹{Number(c.interestPaid).toLocaleString("en-IN")}</p>
                          {Number(c.penaltyPaid) > 0 && (
                            <p className="font-bold font-mono text-[10px] text-red-400">Penalty Paid: ₹{Number(c.penaltyPaid).toLocaleString("en-IN")}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 4: Internal Notes ─────────────────────────────────── */}
            <div className="bg-[#18181b] p-5 rounded-xl border border-zinc-800/80 space-y-3.5">
              <h3 className="font-bold text-xs tracking-wider uppercase text-amber-400 flex items-center gap-2 border-b border-zinc-700/60 pb-2.5">
                <FileText className="h-4 w-4" /> 📝 PRIVATE INTERNAL NOTES
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Private notes visible only to the administrator. Record discussions, payment promises, reminders, observations, and audit logs.
              </p>
              <div className="space-y-3">
                <textarea
                  rows={6}
                  maxLength={5500}
                  placeholder={`Example:\nCustomer requested 5 more days.\nInterest paid on 20 July 2026.\nPromised to clear principal next month.\nVisited customer's home.\nReminder sent via WhatsApp.`}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  onBlur={() => handleSaveNotes(notesText)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60 focus:border-amber-500/60 p-4 text-sm font-medium transition-all"
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[10px] text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
                    {((loan as any).internalNotesUpdatedAt || (loan.borrower as any).internalNotesUpdatedAt) ? (
                      <>
                        <span><strong>Last Updated:</strong> {new Date((loan as any).internalNotesUpdatedAt || (loan.borrower as any).internalNotesUpdatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} at {new Date((loan as any).internalNotesUpdatedAt || (loan.borrower as any).internalNotesUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                        <span><strong>Updated By:</strong> Admin</span>
                      </>
                    ) : (
                      <span><strong>Last Updated:</strong> Never</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveNotes(notesText)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 transition-all shadow-sm shadow-yellow-500/5"
                    >
                      Save Notes
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setNotesText("");
                        await handleSaveNotes("");
                      }}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 transition"
                    >
                      Clear Notes
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 5: Audit / Destructive actions ───────────────────── */}
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
              <div className="text-zinc-400">
                <span>Borrower Record: <strong className="text-zinc-200">{loan.borrower.name}</strong></span>
                <span className="mx-2 text-zinc-600">|</span>
                <span>Database ID: <code className="font-mono text-[10px] text-zinc-300">{loan.borrowerId}</code></span>
              </div>
              <button
                type="button"
                disabled={isDeletingBorrower}
                onClick={() => onDeleteBorrower(loan.borrowerId, loan.borrower.name)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs"
              >
                {isDeletingBorrower ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>{isDeletingBorrower ? "Deleting borrower profile..." : "Delete Borrower Profile Entirely"}</span>
              </button>
            </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="shrink-0 px-6 py-3.5 border-t border-zinc-800/80 bg-[#121215] flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-400">
              Loan File ID: <code className="font-mono text-[11px] text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{loan.loanId}</code>
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg transition"
            >
              Close Audit File
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
