"use client";

import React, { useState, useEffect, useTransition, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { recordPaymentAction } from "@/features/payments/actions/record-payment.action";
import { extendLoanAction } from "@/features/loans/actions/extend-loan.action";
import { payAndExtendAction } from "../actions/pay-and-extend.action";
import { generateLoanExtensionPdf } from "../utils/generate-loan-extension-pdf";
import { overdueAndPenaltyAction } from "../actions/overdue-and-penalty.action";
import { sendReminderAction } from "@/features/notifications/actions/send-reminder.action";
import { deleteLoanAction } from "@/features/loans/actions/delete-loan.action";
import { deleteBorrowerAction } from "@/features/borrowers/actions/delete-borrower.action";
import { updateBorrowerAction } from "@/features/borrowers/actions/update-borrower.action";
import { getExtraLoanDetailsAction } from "@/features/loans/actions/get-extra-loan-details.action";
import { deletePaymentAction } from "@/features/payments/actions/delete-payment.action";
import { saveInternalNotesAction } from "@/features/borrowers/actions/save-internal-notes.action";
import { updatePenaltySettingsAction } from "../actions/update-penalty-settings.action";
import { getPenaltyLedgerAction } from "../actions/get-penalty-ledger.action";
import { calculateAccruedPenalty } from "@/domain/penalty-calculator";
import { calculateDueDate } from "@/domain/due-date-calculator";
import {
  Search, Plus, Send, Landmark, Calendar, RefreshCw, CreditCard, ChevronRight,
  Trash2, Users, Mail, FileText, MapPin, User, Eye, EyeOff, Edit, Clock,
  AlertTriangle, Check, CheckCircle2, XCircle, ChevronDown, ListFilter, X,
  ShieldAlert, Settings, Percent, DollarSign, History
} from "lucide-react";
import type { LoanManagementDetailResult } from "../actions/get-loan-management-data.action";
import type { Payment, NotificationLog, PenaltyLedger, LoanCycle } from "@/db/schema";
import { calculatePeriods, calculateMonthlyInterest } from "@/domain/interest-calculator";
import { generateActiveLoansPdf } from "../utils/generate-active-loans-pdf";
import { differenceInDays } from "date-fns";
import { FinexaCard3D, FinexaStaggerContainer, FinexaStaggerItem } from "@/components/motion/finexa-motion";
import { FinexaMoneyEffect, FinexaCycleEffect, FinexaDocumentEffect } from "@/components/motion/finexa-effects";

interface LoanManagementListProps {
  initialLoans: LoanManagementDetailResult[];
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
      badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      label: "Active",
      icon: <Clock className="h-3 w-3" />
    },
    due_today: {
      badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      label: "Due Today",
      icon: <Clock className="h-3 w-3 animate-[pulse_1.5s_infinite]" />
    },
    overdue: {
      badge: "bg-red-500/10 text-red-400 border border-red-500/20",
      label: "Overdue",
      icon: <AlertTriangle className="h-3 w-3" />
    },
    paid: {
      badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      label: "Paid",
      icon: <Check className="h-3 w-3" />
    }
  }[dynamicStatus];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function getCardGlow(status: string) {
  if (status === "overdue") {
    return "bg-red-500/[0.03] hover:bg-red-500/[0.05] border-red-500/25 shadow-[0_0_15px_-3px_rgba(239,68,68,0.25)] hover:shadow-[0_0_25px_0_rgba(239,68,68,0.35)]";
  }
  if (status === "due_today") {
    return "bg-blue-500/[0.03] hover:bg-blue-500/[0.05] border-blue-500/25 shadow-[0_0_15px_-3px_rgba(59,130,246,0.25)] hover:shadow-[0_0_25px_0_rgba(59,130,246,0.35)] animate-[pulse_4s_infinite_ease-in-out]";
  }
  if (status === "paid") {
    return "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] border-emerald-500/15 shadow-[0_0_12px_-3px_rgba(16,185,129,0.12)] hover:shadow-[0_0_20px_0_rgba(16,185,129,0.2)]";
  }
  // active
  return "bg-amber-500/[0.02] hover:bg-amber-500/[0.04] border-amber-500/20 shadow-[0_0_15px_-3px_rgba(212,175,55,0.15)] hover:shadow-[0_0_22px_0_rgba(212,175,55,0.22)]";
}

export function LoanManagementList({ initialLoans }: LoanManagementListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loans, setLoans] = useState<LoanManagementDetailResult[]>(initialLoans);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [isPending, startTransition] = useTransition();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    toast.info("Generating Active Loans Backup PDF...");

    setTimeout(() => {
      try {
        generateActiveLoansPdf(loans);
        toast.success("PDF generated successfully!");
      } catch (err: any) {
        toast.error(err?.message || "Unable to generate the backup PDF. Your loan data has not been changed. Please try again.");
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 100);
  };

  // Dialog States
  const [selectedLoan, setSelectedLoan] = useState<LoanManagementDetailResult | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [originalNotesText, setOriginalNotesText] = useState("");

  // Form inputs
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"interest" | "principal" | "penalty">("interest");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]!);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("0");
  const [paymentActionMode, setPaymentActionMode] = useState<"record" | "pay_extend" | "overdue_penalty" | "partial">("record");

  // Edit borrower inputs
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerMobile, setBorrowerMobile] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [borrowerPan, setBorrowerPan] = useState("");
  const [borrowerAadhaar, setBorrowerAadhaar] = useState("");
  const [borrowerLocation, setBorrowerLocation] = useState("");

  // Details extra data
  const [extraDetails, setExtraDetails] = useState<{ payments: Payment[]; notifications: NotificationLog[]; cycles?: LoanCycle[] } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  // Penalty settings state
  const [penaltyTypeInput, setPenaltyTypeInput] = useState<"fixed" | "percentage">("fixed");
  const [penaltyRateInput, setPenaltyRateInput] = useState("50");
  const [penaltyLedger, setPenaltyLedger] = useState<PenaltyLedger[]>([]);
  const [isUpdatingPenalty, setIsUpdatingPenalty] = useState(false);

  // 3D Motion System States
  const [showMoneyEffect, setShowMoneyEffect] = useState(false);
  const [cycleEffectText, setCycleEffectText] = useState<string | null>(null);
  const [documentEffectText, setDocumentEffectText] = useState<string | null>(null);

  // Sync state with parent props when page dynamic refresh happens
  useEffect(() => {
    setLoans(initialLoans);
  }, [initialLoans]);

  useEffect(() => {
    if (selectedLoan) {
      const updated = loans.find(l => l.loanId === selectedLoan.loanId);
      if (updated) {
        setSelectedLoan(updated);
      }
    }
  }, [loans]);

  // Deep linking triggers
  useEffect(() => {
    const deepLinkId = searchParams.get("loanId") || searchParams.get("borrowerId");
    if (deepLinkId && loans.length > 0) {
      const match = loans.find(l => l.loanId === deepLinkId || l.borrowerId === deepLinkId);
      if (match) {
        handleViewDetails(match);
      }
    }
  }, [searchParams, loans]);

  // ── Calculation helpers ───────────────────────────────────────────────────
  const getDuration = (dateGiven: string, dueDate: string, interestType: string) => {
    try {
      const given = new Date(dateGiven);
      const due = new Date(dueDate);
      if (interestType === "daily") {
        const days = differenceInDays(due, given);
        return `${days} Day${days !== 1 ? "s" : ""}`;
      } else {
        const months = calculatePeriods(dateGiven, dueDate);
        return `${months} Month${months !== 1 ? "s" : ""}`;
      }
    } catch {
      return "N/A";
    }
  };

  const getInterestAmount = (loan: LoanManagementDetailResult) => {
    const periods = calculatePeriods(loan.dateGiven, loan.dueDate);
    const monthlyInt = calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate));
    return periods * monthlyInt;
  };

  // ── Search & Filter & Sort logics ──────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0]!;
  const today = new Date(todayStr);

  const deferredSearch = useDeferredValue(search);

  const filteredLoans = useMemo(() => {
    return loans
      .filter((loan) => {
        // 1. Search Query
        const query = deferredSearch.trim().toLowerCase();
        if (query) {
          const name = loan.borrower.name.toLowerCase();
          const mobile = loan.borrower.mobile.toLowerCase();
          const aadhaar = (loan.borrower.aadhaarDecrypted || "").toLowerCase();
          const pan = (loan.borrower.panDecrypted || "").toLowerCase();
          if (!name.includes(query) && !mobile.includes(query) && !aadhaar.includes(query) && !pan.includes(query)) {
            return false;
          }
        }

        // 2. Status Filters
        if (statusFilter === "all") return true;

        const isPaid = loan.outstandingBalance <= 0 || loan.status === "closed";
        const isUnpaid = loan.outstandingBalance > 0 && loan.status !== "closed";

        const loanDueDate = new Date(loan.dueDate);
        const isDueToday = loan.dueDate === todayStr;
        const isOverdue = loan.status === "overdue" || (loanDueDate < today && isUnpaid);

        if (statusFilter === "active") {
          return isUnpaid && (loan.status === "active" || loan.status === "extended" || loan.status === "overdue");
        }
        if (statusFilter === "due_today") {
          return isDueToday && isUnpaid;
        }
        if (statusFilter === "upcoming_due") {
          return loan.dueDate > todayStr && isUnpaid;
        }
        if (statusFilter === "overdue") {
          return isOverdue;
        }
        if (statusFilter === "completed") {
          return isPaid;
        }
        if (statusFilter === "paid") {
          return isPaid;
        }
        if (statusFilter === "unpaid") {
          return isUnpaid;
        }

        return true;
      })
      .sort((a, b) => {
        // 3. Sorting
        if (sortBy === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "highest_amount") {
          return Number(b.principal) - Number(a.principal);
        }
        if (sortBy === "lowest_amount") {
          return Number(a.principal) - Number(b.principal);
        }
        if (sortBy === "due_date") {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (sortBy === "borrower_name") {
          return a.borrower.name.localeCompare(b.borrower.name);
        }
        return 0;
      });
  }, [loans, deferredSearch, statusFilter, sortBy, todayStr]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSaveNotes = async (borrowerId: string, textToSave: string) => {
    if (textToSave === originalNotesText) return;

    const res = await saveInternalNotesAction(borrowerId, textToSave);
    if (res.success) {
      setOriginalNotesText(textToSave);
      toast.success("Notes saved successfully.");
    } else {
      toast.error(res.error || "Failed to save notes.");
    }
  };

  const handleDetailsClose = () => {
    if (selectedLoan && notesText !== originalNotesText) {
      handleSaveNotes(selectedLoan.borrowerId, notesText);
    }
    setDetailsOpen(false);
  };

  const handleViewDetails = async (loan: LoanManagementDetailResult) => {
    setSelectedLoan(loan);
    setNotesText((loan.borrower as any).internalNotes || "");
    setOriginalNotesText((loan.borrower as any).internalNotes || "");
    setPenaltyRateInput(((loan as any).penaltyRate || 20).toString());
    setDetailsOpen(true);
    setDetailsLoading(true);
    setExtraDetails(null);
    setPenaltyLedger([]);
    setShowSensitive(false);

    startTransition(async () => {
      const [res, ledgerRes] = await Promise.all([
        getExtraLoanDetailsAction(loan.loanId),
        getPenaltyLedgerAction(loan.loanId),
      ]);
      if (res.success && res.data) {
        setExtraDetails(res.data);
      } else {
        toast.error("Failed to load payment history ledger.");
      }
      if (ledgerRes.success && ledgerRes.data) {
        setPenaltyLedger(ledgerRes.data);
      }
      setDetailsLoading(false);
    });
  };

  const handleUpdatePenaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    const rate = Number(penaltyRateInput);
    if (isNaN(rate) || rate < 0) {
      toast.error("Please enter a valid non-negative penalty rate.");
      return;
    }

    setIsUpdatingPenalty(true);
    const res = await updatePenaltySettingsAction(selectedLoan.loanId, rate);
    setIsUpdatingPenalty(false);

    if (res.success) {
      toast.success(`Penalty rate updated to ₹${rate} per ₹1,000 / day`);
      const ledgerRes = await getPenaltyLedgerAction(selectedLoan.loanId);
      if (ledgerRes.success && ledgerRes.data) {
        setPenaltyLedger(ledgerRes.data);
      }
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to update penalty settings");
    }
  };

  const handleEditOpen = (loan: LoanManagementDetailResult, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedLoan(loan);
    setBorrowerName(loan.borrower.name);
    setBorrowerMobile(loan.borrower.mobile);
    setBorrowerEmail(loan.borrower.email || "");
    setBorrowerPan(loan.borrower.panDecrypted);
    setBorrowerAadhaar(loan.borrower.aadhaarDecrypted);
    setBorrowerLocation(loan.borrower.locationUrl || "");
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    const fd = new FormData();
    fd.append("borrowerId", selectedLoan.borrowerId);
    fd.append("name", borrowerName);
    fd.append("mobile", borrowerMobile);
    fd.append("email", borrowerEmail);
    fd.append("pan", borrowerPan.toUpperCase());
    fd.append("aadhaar", borrowerAadhaar);
    fd.append("locationUrl", borrowerLocation);

    startTransition(async () => {
      const res = await updateBorrowerAction(null, fd);
      if (res.success) {
        toast.success("Borrower details updated successfully!");
        setEditOpen(false);
        router.refresh();
      } else {
        if (res.error && typeof res.error === "object") {
          const errors = Object.values(res.error).flat().join(", ");
          toast.error(errors || "Failed to update borrower details");
        } else {
          toast.error((res.error as string) || "Failed to update borrower details");
        }
      }
    });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    if (paymentActionMode === "pay_extend") {
      await handlePayAndExtendConfirm();
      return;
    }
    if (paymentActionMode === "overdue_penalty") {
      await handleOverduePenaltyConfirm();
      return;
    }

    const fd = new FormData();
    fd.append("loanId", selectedLoan.loanId);
    fd.append("amount", paymentAmount);
    fd.append("paymentType", paymentType);
    fd.append("paymentDate", paymentDate);
    fd.append("notes", paymentNotes);

    startTransition(async () => {
      const res = await recordPaymentAction(null, fd);
      if (res.success) {
        setShowMoneyEffect(true);
        const paidAmt = Number(paymentAmount);
        setLoans((prev) =>
          prev.map((l) => {
            if (l.loanId === selectedLoan.loanId) {
              const newBal = Math.max(0, l.outstandingBalance - paidAmt);
              return { ...l, outstandingBalance: newBal, status: newBal === 0 ? "closed" : l.status };
            }
            return l;
          })
        );
        toast.success(`Payment of ₹${paidAmt.toLocaleString("en-IN")} recorded!`);
        setPaymentOpen(false);
        setPaymentAmount("");
        setPaymentNotes("");
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to record payment");
      }
    });
  };

  const handlePayAndExtendConfirm = async () => {
    if (!selectedLoan) return;
    startTransition(async () => {
      const res = await payAndExtendAction(selectedLoan.loanId, paymentDate, paymentNotes);
      if (!res.success) {
        const errText = typeof res.error === "string" ? res.error : "Failed to process Pay & Extend";
        toast.error(errText);
        return;
      }
      const data = res.data;
      setCycleEffectText("Pay & Extend Successful — Next Cycle Activated");
      setTimeout(() => setCycleEffectText(null), 1500);
      const newDueDateStr = data.newDueDate;
      setLoans((prev) =>
        prev.map((l) => (l.loanId === selectedLoan.loanId ? { ...l, dueDate: newDueDateStr, status: "extended" } : l))
      );

      // Automatic PDF Generation & Retry Toast Handling
      try {
        generateLoanExtensionPdf(data);
        toast.success(`Loan extension completed successfully! Next cycle due: ${data.newDueDate}`, {
          action: {
            label: "📄 Download PDF",
            onClick: () => generateLoanExtensionPdf(data),
          },
          duration: 8000,
        });
      } catch (pdfErr) {
        console.error("PDF generation error:", pdfErr);
        toast.error("Loan extension completed, but the PDF could not be generated.", {
          action: {
            label: "🔄 Retry PDF",
            onClick: () => generateLoanExtensionPdf(data),
          },
          duration: 10000,
        });
      }

      setPaymentOpen(false);
      setPaymentNotes("");
      router.refresh();
    });
  };

  const handleOverduePenaltyConfirm = async () => {
    if (!selectedLoan) return;
    startTransition(async () => {
      const res = await overdueAndPenaltyAction(selectedLoan.loanId, paymentDate, paymentNotes);
      if (res.success) {
        setCycleEffectText("Overdue Cycle Cleared & New Cycle Activated");
        setTimeout(() => setCycleEffectText(null), 1500);
        if (res.data?.newDueDate) {
          const newDueDateStr = res.data.newDueDate;
          setLoans((prev) =>
            prev.map((l) =>
              l.loanId === selectedLoan.loanId ? { ...l, dueDate: newDueDateStr, status: "active", penaltyAmount: "0" } : l
            )
          );
        }
        toast.success(`Overdue cycle cleared! New cycle start: ${paymentDate}, Next due: ${res.data?.newDueDate}`);
        setPaymentOpen(false);
        setPaymentNotes("");
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to process Overdue & Penalty payment");
      }
    });
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    startTransition(async () => {
      const res = await sendReminderAction(selectedLoan.loanId, Number(penaltyAmount || 0));
      if (res.success) {
        toast.success("Reminder sent via SMS & Email!");
        setReminderOpen(false);
        setPenaltyAmount("0");
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to send reminder");
      }
    });
  };

  const handleExtendConfirm = async () => {
    if (!selectedLoan) return;

    startTransition(async () => {
      const res = await extendLoanAction(selectedLoan.loanId);
      if (res.success) {
        toast.success("Loan period extended by 1 month!");
        setExtendOpen(false);
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to extend loan");
      }
    });
  };

  const handleDeleteLoan = async (loanId: string, borrowerName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!confirm(`Are you sure you want to delete the loan for ${borrowerName}? This will permanently delete the loan and all associated repayments. This action cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteLoanAction(loanId);
      if (res.success) {
        setLoans((prev) => prev.filter((l) => l.loanId !== loanId));
        toast.success("Loan deleted successfully!");
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to delete loan");
      }
    });
  };

  const handleDeleteBorrower = async (borrowerId: string, borrowerName: string) => {
    if (!confirm(`CAUTION: Are you sure you want to delete ${borrowerName}? This will permanently remove their profile and ALL associated loans and repayment ledgers. This action is irreversible.`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteBorrowerAction(borrowerId);
      if (res.success) {
        toast.success("Borrower profile deleted successfully.");
        setDetailsOpen(false);
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to delete borrower profile");
      }
    });
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!selectedLoan) return;
    if (!confirm("Delete this payment record? This will restore the outstanding balance.")) return;

    startTransition(async () => {
      const res = await deletePaymentAction(paymentId, selectedLoan.loanId);
      if (res.success) {
        toast.success("Payment record deleted.");
        // Refetch extra details in place
        const extraRes = await getExtraLoanDetailsAction(selectedLoan.loanId);
        if (extraRes.success && extraRes.data) {
          setExtraDetails(extraRes.data);
        }
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to delete payment");
      }
    });
  };

  // ── Render Card Avatar ────────────────────────────────────────────────────
  const getAvatarInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-5">
      <FinexaMoneyEffect active={showMoneyEffect} onComplete={() => setShowMoneyEffect(false)} />
      <FinexaCycleEffect active={!!cycleEffectText} text={cycleEffectText || undefined} />
      <FinexaDocumentEffect active={!!documentEffectText} text={documentEffectText || undefined} />
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, mobile, PAN, or Aadhaar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
          />
        </div>

        {/* Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Dropdown */}
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
            <SelectTrigger className="h-11 min-w-[140px] px-4 rounded-xl border border-border bg-transparent text-sm font-semibold hover:bg-accent/40 transition-colors">
              <div className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Status: <strong className="capitalize text-primary">{statusFilter.replace("_", " ")}</strong>
                </span>
              </div>
            </SelectTrigger>
            <SelectContent align="start" className="rounded-2xl border border-border bg-white dark:bg-[#111827] z-[100] min-w-56 p-1.5 max-h-[60vh] shadow-2xl">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
                Filter Loans
              </div>
              <SelectItem value="all">All Loans</SelectItem>
              <SelectItem value="active">Active Loans</SelectItem>
              <SelectItem value="due_today">Due Today</SelectItem>
              <SelectItem value="upcoming_due">Upcoming Due</SelectItem>
              <SelectItem value="overdue">Overdue Loans</SelectItem>
              <SelectItem value="completed">Completed Loans</SelectItem>
              <SelectItem value="paid">Paid Loans</SelectItem>
              <SelectItem value="unpaid">Unpaid Loans</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort dropdown */}
          <Select value={sortBy} onValueChange={(val) => setSortBy(val || "newest")}>
            <SelectTrigger className="h-11 w-44 rounded-xl border-border bg-transparent text-sm font-semibold">
              <SelectValue placeholder="Sort Options" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-white dark:bg-card z-50">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="highest_amount">Highest Amount</SelectItem>
              <SelectItem value="lowest_amount">Lowest Amount</SelectItem>
              <SelectItem value="due_date">Due Date</SelectItem>
              <SelectItem value="borrower_name">Borrower (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          {/* Download Active Loans PDF Button */}
          <Button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="h-11 px-4 rounded-xl gap-2 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 hover:from-amber-500/25 hover:to-amber-500/25 text-amber-400 border border-amber-500/40 text-sm font-bold shadow-[0_0_15px_-3px_rgba(212,175,55,0.15)] hover:shadow-[0_0_20px_0_rgba(212,175,55,0.25)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed fx-pressable"
          >
            {isGeneratingPdf ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 text-amber-400" />
                <span>Download Active Loans PDF</span>
              </>
            )}
          </Button>

          {/* New Loan */}
          <Link href="/loans/new">
            <Button className="h-11 px-4 rounded-xl gap-2 fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable text-sm font-bold">
              <Plus className="h-4 w-4" /> New Loan
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Status Bar / Stats ─────────────────────────────────────────────── */}
      <div className="text-xs text-muted-foreground flex items-center justify-between">
        {isPending ? (
          <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Synchronizing changes...</span>
        ) : (
          <span>Showing {filteredLoans.length} of {loans.length} loan portfolio{loans.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* ── Cards Grid ──────────────────────────────────────────────────────── */}
      {filteredLoans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center fx-glass-card rounded-[22px] border border-border">
          <div className="h-14 w-14 bg-secondary rounded-2xl flex items-center justify-center mb-4 border border-border">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <p className="font-bold text-foreground">No records matched</p>
          <p className="text-xs text-muted-foreground mt-1 mb-5">Try checking your search inputs or filter toggles.</p>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLoans.map((loan) => {
            const dynamicStatus = getCardStatus(loan.status, loan.outstandingBalance, loan.dueDate);
            const cardBg = getCardGlow(dynamicStatus);
            const duration = getDuration(loan.dateGiven, loan.dueDate, loan.interestType);
            const isSettled = loan.outstandingBalance <= 0 || loan.status === "closed";

            const accruedPenalty = calculateAccruedPenalty({
              principal: Number(loan.principal),
              dueDate: loan.dueDate,
              status: loan.status,
              penaltyRate: Number((loan as any).penaltyRate || 20),
              manualPenaltyAmount: Number(loan.penaltyAmount || 0),
            });

            return (
              <div
                key={loan.loanId}
                className={`flex flex-col justify-between h-full fx-glass-card rounded-[22px] p-5 border transition-all duration-300 ease-out fx-3d-hover ${cardBg}`}
              >
                {/* Profile + Status Row */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl fx-brand-gradient flex items-center justify-center text-white font-black text-sm shrink-0 fx-shadow-glow-sm">
                        {getAvatarInitials(loan.borrower.name)}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-semibold text-sm text-foreground tracking-tight truncate max-w-[130px]">{loan.borrower.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{loan.borrower.mobile}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={loan.status} outstanding={loan.outstandingBalance} dueDate={loan.dueDate} />
                      {accruedPenalty.isPenaltyActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertTriangle className="h-3 w-3" />
                          PENALTY ACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Loan Details Grid */}
                  <div className="grid grid-cols-2 gap-3 bg-black/15 dark:bg-black/35 p-3.5 rounded-xl border border-white/[0.02] text-left text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Loan Amount</p>
                      <p className="font-extrabold text-foreground mt-0.5">₹{Number(loan.principal).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Outstanding Amount</p>
                      <p className={`font-extrabold mt-0.5 ${loan.outstandingBalance > 0 ? "text-primary" : "text-emerald-400"}`}>
                        ₹{loan.outstandingBalance.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Penalty</p>
                      <p className={`font-extrabold mt-0.5 ${accruedPenalty.totalPenalty > 0 ? "text-red-400 font-bold" : "text-emerald-400"}`}>
                        ₹{accruedPenalty.totalPenalty.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Due Date</p>
                      <p className="font-semibold text-foreground mt-0.5">
                        {new Date(loan.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Timeline</p>
                      <p className={`font-semibold mt-0.5 ${
                        dynamicStatus === "overdue" ? "text-red-400 font-bold" :
                        dynamicStatus === "due_today" ? "text-blue-400 font-bold" :
                        dynamicStatus === "paid" ? "text-emerald-400" :
                        "text-amber-400"
                      }`}>
                        {dynamicStatus === "overdue" && `${differenceInDays(today, new Date(loan.dueDate))} Days Overdue`}
                        {dynamicStatus === "due_today" && "Due Today"}
                        {dynamicStatus === "active" && `${differenceInDays(new Date(loan.dueDate), today)} Days Left`}
                        {dynamicStatus === "paid" && "Settled"}
                      </p>
                    </div>
                    <div className="col-span-2 border-t border-white/[0.04] pt-2 mt-0.5 flex justify-between text-[10px] text-muted-foreground">
                      <span>Rate: ₹{Number(loan.interestRate)}/{loan.interestType === "monthly" ? "mo" : "day"}</span>
                      <span>Payment Status: <strong className="capitalize">{
                        dynamicStatus === "paid" ? "Paid" :
                        dynamicStatus === "due_today" ? "Payment Pending" :
                        dynamicStatus === "overdue" ? "Overdue" :
                        "Active"
                      }</strong></span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex flex-wrap items-center gap-1.5 pt-4 mt-4 border-t border-white/[0.03]">
                  {!isSettled ? (
                    <>
                      <button
                        onClick={() => { setSelectedLoan(loan); setPaymentAmount(""); setPaymentNotes(""); setPaymentOpen(true); }}
                        className="flex-1 min-w-[50px] flex items-center justify-center gap-1 h-9 rounded-xl bg-secondary hover:bg-accent/40 text-primary text-xs font-bold transition-all duration-200 fx-pressable"
                      >
                        <Landmark className="h-3.5 w-3.5" /> Pay
                      </button>
                      <button
                        onClick={() => { setSelectedLoan(loan); setPenaltyAmount("0"); setReminderOpen(true); }}
                        className="flex-1 min-w-[50px] flex items-center justify-center gap-1 h-9 rounded-xl bg-secondary hover:bg-accent/40 text-primary text-xs font-bold transition-all duration-200 fx-pressable"
                      >
                        <Send className="h-3.5 w-3.5" /> Remind
                      </button>
                    </>
                  ) : null}

                  <button
                    onClick={() => handleViewDetails(loan)}
                    className="flex-1 min-w-[70px] flex items-center justify-center gap-1 h-9 rounded-xl bg-accent/25 hover:bg-accent/50 text-foreground text-xs font-semibold transition-all duration-200"
                  >
                    View Details
                  </button>

                  <button
                    onClick={(e) => handleEditOpen(loan, e)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                    title="Edit Borrower Details"
                  >
                    <Edit className="h-4 w-4" />
                  </button>

                  <button
                    onClick={(e) => handleDeleteLoan(loan.loanId, loan.borrower.name, e)}
                    disabled={isPending}
                    className="p-2 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-550/10 transition-all duration-200"
                    title="Delete Loan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Repayment Modal ─────────────────────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-2xl max-w-lg fx-glass-card border-border/50 bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center justify-between">
              <span>Record Repayment & Cycle Actions</span>
              <span className="text-xs font-semibold text-muted-foreground">{selectedLoan?.borrower.name}</span>
            </DialogTitle>
            <DialogDescription>
              Select payment action, verify cycle parameters, and confirm transaction for <strong>{selectedLoan?.borrower.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            {selectedLoan && (() => {
              const principalNum = Number(selectedLoan.principal || 0);
              const rateNum = Number(selectedLoan.interestRate || 0);
              const monthlyInterest = calculateMonthlyInterest(principalNum, rateNum);
              const currentDueDateObj = new Date(selectedLoan.dueDate);
              const isLoanOverdue = currentDueDateObj < new Date() || selectedLoan.status === "overdue";
              
              const penaltyRes = calculateAccruedPenalty({
                principal: principalNum,
                dueDate: selectedLoan.dueDate,
                status: selectedLoan.status,
                penaltyRate: Number(selectedLoan.penaltyRate || 50),
                manualPenaltyAmount: Number(selectedLoan.penaltyAmount || 0),
              });
              const penaltyAmt = Math.round(penaltyRes.totalPenalty);
              const overdueTotal = monthlyInterest + penaltyAmt;

              const currentCycleMonth = currentDueDateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
              const nextDueDateObj = calculateDueDate(currentDueDateObj);
              const nextCycleMonth = nextDueDateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
              const clearanceDateObj = paymentDate ? new Date(paymentDate) : new Date();
              const newCycleStartStr = clearanceDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

              return (
                <div className="space-y-4">
                  {/* Action Selection Tabs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-accent/20 border border-border/40 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => { setPaymentActionMode("record"); setPaymentType("interest"); }}
                      className={`py-2 px-1 rounded-lg text-center transition-all ${
                        paymentActionMode === "record" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      💰 Record
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPaymentActionMode("pay_extend"); }}
                      className={`py-2 px-1 rounded-lg text-center transition-all ${
                        paymentActionMode === "pay_extend" ? "bg-amber-600 text-white shadow" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🔄 Pay & Extend
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPaymentActionMode("overdue_penalty"); }}
                      className={`py-2 px-1 rounded-lg text-center transition-all ${
                        paymentActionMode === "overdue_penalty"
                          ? "bg-red-600 text-white shadow"
                          : isLoanOverdue
                          ? "text-red-400 font-extrabold hover:text-red-300"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ⚠️ Overdue
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPaymentActionMode("partial"); setPaymentType("principal"); }}
                      className={`py-2 px-1 rounded-lg text-center transition-all ${
                        paymentActionMode === "partial" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      💳 Partial
                    </button>
                  </div>

                  {/* MODE SPECIFIC FORMS */}
                  {paymentActionMode === "pay_extend" ? (
                    /* PAY & EXTEND CONFIRMATION BOX */
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-xs">
                      <div className="flex items-center justify-between font-bold border-b border-amber-500/20 pb-2">
                        <span className="text-amber-400 font-extrabold flex items-center gap-1.5">
                          <RefreshCw className="h-4 w-4 animate-spin" /> PAY & EXTEND CONFIRMATION
                        </span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full uppercase">1 Cycle Extension</span>
                      </div>
                      <div className="space-y-1.5 text-foreground">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current Interest:</span>
                          <span className="font-bold text-amber-300">₹{monthlyInterest.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Principal Outstanding:</span>
                          <span className="font-bold text-foreground">₹{principalNum.toLocaleString("en-IN")} (Remains 100%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment Amount:</span>
                          <span className="font-extrabold text-emerald-400 text-sm">₹{monthlyInterest.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between border-t border-amber-500/20 pt-1.5 text-[11px]">
                          <span className="text-muted-foreground">Current Cycle:</span>
                          <span className="font-semibold text-foreground">{currentCycleMonth}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Next Cycle:</span>
                          <span className="font-extrabold text-primary">{nextCycleMonth}</span>
                        </div>
                      </div>
                    </div>
                  ) : paymentActionMode === "overdue_penalty" ? (
                    /* OVERDUE & PENALTY CONFIRMATION BOX */
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3 text-xs">
                      <div className="flex items-center justify-between font-bold border-b border-red-500/20 pb-2">
                        <span className="text-red-400 font-extrabold flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4" /> OVERDUE & PENALTY SETTLEMENT
                        </span>
                        <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full uppercase">{penaltyRes.daysOverdue} Days Overdue</span>
                      </div>
                      <div className="space-y-1.5 text-foreground">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Original Due Date:</span>
                          <span className="font-semibold text-foreground">{selectedLoan.dueDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment Date:</span>
                          <span className="font-semibold text-foreground">{paymentDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Interest Amount:</span>
                          <span className="font-semibold text-foreground">₹{monthlyInterest.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Accrued Penalty:</span>
                          <span className="font-bold text-red-400">₹{penaltyAmt.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between border-t border-red-500/20 pt-1.5 font-bold">
                          <span className="text-foreground">Total Required Payment:</span>
                          <span className="text-sm font-black text-red-400">₹{overdueTotal.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-[11px] border-t border-red-500/20 pt-1 text-emerald-400 font-semibold">
                          <span>New Cycle Start Date:</span>
                          <span>{newCycleStartStr}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* REGULAR / PARTIAL PAYMENT INPUTS */
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹)*</Label>
                        <Input
                          type="number"
                          placeholder={paymentActionMode === "partial" ? "e.g. 2000 (Partial)" : "₹1000"}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          required={paymentActionMode === "record" || paymentActionMode === "partial"}
                          className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Type / Allocation*</Label>
                        <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                          <SelectTrigger className="h-11 rounded-xl bg-transparent border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-white dark:bg-card">
                            <SelectItem value="interest">Interest Payment</SelectItem>
                            <SelectItem value="principal">Principal Reduction</SelectItem>
                            <SelectItem value="penalty">Late Penalty Settlement</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Common Payment Date Input */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Actual Payment Date*</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
                    />
                  </div>

                  {/* Common Notes Input */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes / Transaction Reference</Label>
                    <Textarea
                      placeholder="e.g. UPI Ref Number, Cash receipt, GPay..."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="rounded-xl bg-transparent border-border"
                    />
                  </div>

                  <DialogFooter className="gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} className="rounded-xl border-border">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className={`rounded-xl border-0 text-white fx-pressable font-bold ${
                        paymentActionMode === "overdue_penalty"
                          ? "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30"
                          : paymentActionMode === "pay_extend"
                          ? "bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30"
                          : "fx-brand-gradient fx-cta-glow"
                      }`}
                    >
                      {isPending
                        ? "Processing..."
                        : paymentActionMode === "pay_extend"
                        ? "Confirm Pay & Extend"
                        : paymentActionMode === "overdue_penalty"
                        ? "Confirm Overdue & Penalty Payment"
                        : "Record Payment"}
                    </Button>
                  </DialogFooter>
                </div>
              );
            })()}
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Send Reminder Modal ─────────────────────────────────────────────── */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Send Repayment Reminder</DialogTitle>
            <DialogDescription>
              Dispatches an automated payment reminder alert to <strong>{selectedLoan?.borrower.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReminderSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Late Penalty Charge (₹, optional)</Label>
              <Input
                type="number"
                value={penaltyAmount}
                onChange={(e) => setPenaltyAmount(e.target.value)}
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
              <p className="text-[10px] text-muted-foreground">This amount will be applied to the loan penalty ledger balance.</p>
            </div>
            <div className="bg-accent/40 rounded-xl p-4 space-y-1.5 text-xs text-muted-foreground border border-border/30">
              <p className="font-bold text-foreground mb-1">Delivered via:</p>
              <p>📧 Email: {selectedLoan?.borrower.email || "N/A"}</p>
              <p>💬 SMS Mobile: {selectedLoan?.borrower.mobile}</p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setReminderOpen(false)} className="rounded-xl border-border">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white gap-2 fx-cta-glow fx-pressable font-bold">
                <Send className="h-4 w-4" /> Send Now
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Extend Loan Period Modal ────────────────────────────────────────── */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Extend Due Period?</DialogTitle>
            <DialogDescription>
              Postpone this loan due date for another month.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2 text-sm text-foreground">
            <p><span className="text-muted-foreground">Current Due Date:</span> <strong>{selectedLoan?.dueDate}</strong></p>
            <p>
              <span className="text-muted-foreground">Interest for Extension:</span>{" "}
              <strong className="text-primary">
                ₹{selectedLoan && calculateMonthlyInterest(Number(selectedLoan.principal), Number(selectedLoan.interestRate)).toLocaleString("en-IN")}
              </strong>
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExtendOpen(false)} className="rounded-xl border-border">
              Cancel
            </Button>
            <Button onClick={handleExtendConfirm} disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable font-bold">
              Confirm Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Borrower Modal ─────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Edit Borrower Details</DialogTitle>
            <DialogDescription>
              Update KYC registration details for <strong>{selectedLoan?.borrower.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name*</Label>
              <Input
                type="text"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number*</Label>
              <Input
                type="tel"
                value={borrowerMobile}
                onChange={(e) => setBorrowerMobile(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address*</Label>
              <Input
                type="email"
                value={borrowerEmail}
                onChange={(e) => setBorrowerEmail(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">PAN Card Number*</Label>
              <Input
                type="text"
                value={borrowerPan}
                onChange={(e) => setBorrowerPan(e.target.value.toUpperCase())}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aadhaar Card Number*</Label>
              <Input
                type="text"
                value={borrowerAadhaar}
                onChange={(e) => setBorrowerAadhaar(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location URL (optional)</Label>
              <Input
                type="text"
                placeholder="Google Maps link"
                value={borrowerLocation}
                onChange={(e) => setBorrowerLocation(e.target.value)}
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl border-border">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable font-bold">
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── View Details Modal (Master On-Demand Details) ───────────────────── */}
      <Dialog open={detailsOpen} onOpenChange={(open) => { if (!open) handleDetailsClose(); else setDetailsOpen(true); }}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader className="border-b border-border/40 pb-4">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center justify-between">
              <span>Detailed Audit File</span>
              {selectedLoan && <StatusBadge status={selectedLoan.status} outstanding={selectedLoan.outstandingBalance} dueDate={selectedLoan.dueDate} />}
            </DialogTitle>
            <DialogDescription>
              Verify KYC, loan limits, payment logs, and reminder dispatch audit trail.
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <div className="space-y-6 pt-4 text-sm">
              {/* ── Section 1: Borrower Info ─────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-primary flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> Borrower Information
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSensitive(!showSensitive)}
                      className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showSensitive ? "Hide IDs" : "Reveal IDs"}</span>
                    </button>
                    <button
                      onClick={(e) => { setDetailsOpen(false); handleEditOpen(selectedLoan, e); }}
                      className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-secondary text-primary text-xs font-bold hover:bg-accent/40 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>Edit KYC</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-accent/25 dark:bg-secondary/20 p-4 rounded-xl border border-border/30">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Full Name</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedLoan.borrower.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Father's Name</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedLoan.borrower.fatherName || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Mobile Number</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedLoan.borrower.mobile}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Father's Mobile</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedLoan.borrower.fatherMobile || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Email Address</span>
                    <p className="font-semibold text-foreground mt-0.5 truncate">{selectedLoan.borrower.email || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Address</span>
                    <p className="font-semibold text-foreground mt-0.5 truncate" title={selectedLoan.borrower.address || ""}>
                      {selectedLoan.borrower.address || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">PAN Number</span>
                    <p className="font-mono font-semibold text-foreground mt-0.5">
                      {showSensitive ? selectedLoan.borrower.panDecrypted : `•••••${selectedLoan.borrower.panDecrypted.slice(-5)}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Aadhaar Number</span>
                    <p className="font-mono font-semibold text-foreground mt-0.5">
                      {showSensitive ? selectedLoan.borrower.aadhaarDecrypted : `••••••••${selectedLoan.borrower.aadhaarDecrypted.slice(-4)}`}
                    </p>
                  </div>
                  {selectedLoan.borrower.locationUrl && (
                    <div className="col-span-1 md:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Location Link</span>
                      <a
                        href={selectedLoan.borrower.locationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-semibold text-xs inline-block mt-1"
                      >
                        Open Maps Geolocation Coordinates ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Section 2: Loan Info ─────────────────────────────────────── */}
              <div className="space-y-3">
                <h3 className="font-bold text-base text-primary flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> Loan Portfolio Details
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-accent/25 dark:bg-secondary/20 p-4 rounded-xl border border-border/30">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Principal</span>
                    <p className="font-extrabold text-foreground mt-0.5">₹{Number(selectedLoan.principal).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Interest Charged</span>
                    <p className="font-semibold text-foreground mt-0.5">₹{getInterestAmount(selectedLoan).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Type</span>
                    <p className="font-semibold text-foreground mt-0.5 capitalize">{selectedLoan.interestType}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Duration</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {getDuration(selectedLoan.dateGiven, selectedLoan.dueDate, selectedLoan.interestType)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Start Date</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedLoan.dateGiven}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Due Date</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedLoan.dueDate}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Amount Paid</span>
                    <p className="font-semibold text-emerald-400 mt-0.5">
                      ₹{(Number(selectedLoan.principal) + getInterestAmount(selectedLoan) + Number(selectedLoan.penaltyAmount || 0) - selectedLoan.outstandingBalance).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Remaining Balance</span>
                    <p className="font-extrabold text-primary mt-0.5">₹{selectedLoan.outstandingBalance.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>

              {/* ── Section 2B: Penalty Details & Settings ───────────────── */}
              {selectedLoan && (() => {
                const currentRate = Number(penaltyRateInput);
                const penaltyInfo = calculateAccruedPenalty({
                  principal: Number(selectedLoan.principal),
                  dueDate: selectedLoan.dueDate,
                  status: selectedLoan.status,
                  penaltyRate: isNaN(currentRate) || currentRate < 0 ? Number((selectedLoan as any).penaltyRate || 20) : currentRate,
                  manualPenaltyAmount: Number(selectedLoan.penaltyAmount || 0),
                });
                const totalInterest = getInterestAmount(selectedLoan);
                const totalPayable = Number(selectedLoan.principal) + totalInterest + penaltyInfo.totalPenalty;

                const penaltyColorClass = 
                  penaltyInfo.totalPenalty === 0
                    ? "text-emerald-400 font-bold text-sm"
                    : penaltyInfo.totalPenalty < 1000
                    ? "text-amber-400 font-extrabold text-sm"
                    : "text-red-400 font-black text-base";

                return (
                  <div className="space-y-4">
                    <h3 className="font-bold text-base text-primary flex items-center gap-1.5 border-b border-border/40 pb-2">
                      <ShieldAlert className="h-4 w-4 text-red-400" /> Penalty Details
                    </h3>

                    {/* FINEXA Premium Dark Penalty Details Card */}
                    <div className="p-5 rounded-2xl bg-black/40 border border-border/60 shadow-xl space-y-4 text-left">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Principal Amount</p>
                          <p className="font-extrabold text-foreground text-sm mt-0.5">
                            ₹{Number(selectedLoan.principal).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Penalty Rate</p>
                          <p className="font-semibold text-[#D4AF37] text-xs mt-0.5">
                            ₹{penaltyInfo.penaltyRatePerThousand} / ₹1,000 / Day
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Overdue Days</p>
                          <p className={`font-bold text-xs mt-0.5 ${penaltyInfo.daysOverdue > 0 ? "text-red-400" : "text-foreground"}`}>
                            {penaltyInfo.daysOverdue > 0 ? `${penaltyInfo.daysOverdue} Days` : "No Penalty (0 Days)"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Daily Penalty</p>
                          <p className="font-semibold text-foreground text-xs mt-0.5">
                            ₹{penaltyInfo.dailyPenalty.toLocaleString("en-IN")}/day
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-border/40 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Penalty</p>
                          <p className={`mt-0.5 ${penaltyColorClass}`}>
                            ₹{penaltyInfo.totalPenalty.toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Amount Payable</p>
                          <p className="font-black text-primary text-base mt-0.5">
                            ₹{totalPayable.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Penalty Rate Real-time Admin Configurator */}
                    <form onSubmit={handleUpdatePenaltySettings} className="p-4 rounded-xl bg-accent/20 dark:bg-secondary/15 border border-border/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                          <Settings className="h-3.5 w-3.5 text-[#D4AF37]" /> Edit Penalty Rate (₹ per ₹1,000 / Day)
                        </h4>
                        <span className="text-[10px] text-muted-foreground">Real-time Calculation</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                            Penalty Rate (₹ per ₹1,000 / Day)
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={penaltyRateInput}
                            onChange={(e) => setPenaltyRateInput(e.target.value)}
                            placeholder="e.g. 5, 10, 15, 20, 50"
                            className="h-10 rounded-xl text-xs bg-transparent border-border text-foreground font-bold"
                            required
                          />
                        </div>

                        <Button
                          type="submit"
                          disabled={isUpdatingPenalty}
                          className="h-10 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-pressable"
                        >
                          {isUpdatingPenalty ? "Saving..." : "Save Penalty Rate"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Formula: Penalty = (Principal ÷ 1,000) × Penalty Rate × Overdue Days
                      </p>
                    </form>

                    {/* Penalty Ledger Audit Log */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-primary" /> Penalty Audit Ledger
                      </h4>
                      {penaltyLedger.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No historical penalty changes logged yet.</p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {penaltyLedger.map((row) => (
                            <div key={row.ledgerId} className="p-2.5 rounded-lg bg-black/20 border border-border/30 text-xs flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-foreground">{row.remarks || "Penalty Updated"}</p>
                                <p className="text-[10px] text-muted-foreground">
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
                );
              })()}

              {/* ── Section 3: Ledger ────────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Repayment History */}
                <div className="space-y-3.5">
                  <h4 className="font-bold text-sm text-foreground border-b border-border/40 pb-2">Repayment History Ledger</h4>
                  {detailsLoading ? (
                    <p className="text-xs text-muted-foreground py-4 flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Loading payments...</p>
                  ) : !extraDetails || extraDetails.payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4">No payments recorded for this loan file.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {extraDetails.payments.map((p) => (
                        <div key={p.paymentId} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/20 dark:bg-secondary/10 border border-border/30">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">{p.paymentType}</span>
                              <span className="text-[10px] text-muted-foreground">{p.paymentDate}</span>
                            </div>
                            {p.notes && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{p.notes}</p>}
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <span className="font-bold text-xs text-primary">+₹{Number(p.amount).toLocaleString("en-IN")}</span>
                            <button
                              onClick={() => handleDeletePayment(p.paymentId)}
                              className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 p-1 rounded transition-colors"
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

                {/* Notifications Dispatch */}
                <div className="space-y-3.5">
                  <h4 className="font-bold text-sm text-foreground border-b border-border/40 pb-2">Notifications Dispatch Log</h4>
                  {detailsLoading ? (
                    <p className="text-xs text-muted-foreground py-4 flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Loading alert logs...</p>
                  ) : !extraDetails || extraDetails.notifications.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4">No alert logs recorded for this loan file.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {extraDetails.notifications.map((n) => (
                        <div key={n.notificationId} className="flex items-start justify-between p-2.5 rounded-lg bg-accent/20 dark:bg-secondary/10 border border-border/30">
                          <div className="min-w-0 flex-1 text-xs">
                            <p className="font-semibold capitalize text-foreground">{n.type} <span className="text-[10px] text-muted-foreground">via {n.channel}</span></p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(n.sentAt).toLocaleString()}</p>
                            {n.errorMessage && <p className="text-[9px] text-red-400 mt-0.5">{n.errorMessage}</p>}
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
              </div>

              {/* Permanent Loan Cycle History */}
              <div className="space-y-3.5 border-t border-border/40 pt-4">
                <h4 className="font-bold text-sm text-foreground flex items-center justify-between border-b border-border/40 pb-2">
                  <span>🔄 Permanent Loan Cycle History</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Audit Recorded Cycles</span>
                </h4>
                {detailsLoading ? (
                  <p className="text-xs text-muted-foreground py-4 flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Loading cycle history...</p>
                ) : !extraDetails || !extraDetails.cycles || extraDetails.cycles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3">No historical cycle extensions logged yet for this loan file.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {extraDetails.cycles.map((c) => (
                      <div key={c.cycleId} className="p-3 rounded-xl bg-accent/20 dark:bg-secondary/15 border border-border/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">Cycle #{c.cycleNumber}</span>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              c.cycleStatus === "paid" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              c.cycleStatus === "overdue_closed" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                              c.cycleStatus === "extended" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                              "bg-secondary text-primary border border-border"
                            }`}>
                              {c.cycleStatus.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Due: {c.originalDueDate} {c.actualPaymentDate ? "· Cleared: " + c.actualPaymentDate : ""} · Principal: ₹{Number(c.remainingPrincipal).toLocaleString("en-IN")}
                          </p>
                          {c.notes && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{c.notes}</p>}
                        </div>
                        <div className="text-right sm:shrink-0">
                          <p className="font-bold text-xs text-primary">Interest Paid: ₹{Number(c.interestPaid).toLocaleString("en-IN")}</p>
                          {Number(c.penaltyPaid) > 0 && (
                            <p className="font-bold text-[10px] text-red-400">Penalty Paid: ₹{Number(c.penaltyPaid).toLocaleString("en-IN")}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Section 4: Internal Notes ─────────────────────────────────── */}
              <div className="space-y-3.5 border-t border-border/40 pt-4">
                <h3 className="font-bold text-base text-primary flex items-center gap-1.5">
                  <FileText className="h-4.5 w-4.5" /> 📝 Internal Notes
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Private notes visible only to the administrator. These notes are used to record conversations, payment promises, reminders, observations, and other loan-related information.
                </p>
                <div className="space-y-3">
                  <textarea
                    rows={20}
                    maxLength={5500}
                    placeholder={`Example:\nCustomer requested 5 more days.\nInterest paid on 20 July 2026.\nPromised to clear principal next month.\nVisited customer's home.\nReminder sent via WhatsApp.`}
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    onBlur={() => handleSaveNotes(selectedLoan.borrowerId, notesText)}
                    className="w-full rounded-2xl bg-black/15 dark:bg-black/35 border border-border/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary p-4 text-sm font-medium transition-all"
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      {(selectedLoan.borrower as any).internalNotesUpdatedAt ? (
                        <>
                          <span><strong>Last Updated:</strong> {new Date((selectedLoan.borrower as any).internalNotesUpdatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} at {new Date((selectedLoan.borrower as any).internalNotesUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                          <span><strong>Updated By:</strong> Admin</span>
                        </>
                      ) : (
                        <span><strong>Last Updated:</strong> Never</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleSaveNotes(selectedLoan.borrowerId, notesText)}
                        className="h-9 px-4 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-cta-glow px-4"
                      >
                        Save Notes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          setNotesText("");
                          await handleSaveNotes(selectedLoan.borrowerId, "");
                        }}
                        className="h-9 px-4 rounded-xl text-xs font-bold border-border"
                      >
                        Clear Notes
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Section 5: Audit / Destructive actions ───────────────────── */}
              <div className="border-t border-border/40 pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Loan File ID: <code className="font-mono text-[10px]">{selectedLoan.loanId}</code></span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDeleteBorrower(selectedLoan.borrowerId, selectedLoan.borrower.name)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-red-500/20 text-red-400 bg-red-500/[0.02] hover:bg-red-500/10 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>{isPending ? "Deleting borrower profile..." : "Delete Borrower Profile Entirely"}</span>
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-border/40 pt-4 mt-6 flex justify-end">
            <Button variant="outline" onClick={handleDetailsClose} className="rounded-xl border-border">
              Close Audit File
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
