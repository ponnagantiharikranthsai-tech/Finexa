"use client";

import React, { useState, useEffect, useTransition, useMemo, useDeferredValue, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LOANS_QUERY_KEY } from "../hooks/use-loan-management-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { recordPaymentAction } from "@/features/payments/actions/record-payment.action";
import { extendLoanAction } from "@/features/loans/actions/extend-loan.action";
import { payAndExtendAction } from "../actions/pay-and-extend.action";
import { generateLoanExtensionPdf } from "../utils/generate-loan-extension-pdf";
import { generatePaymentCompletedPdf } from "../utils/generate-payment-completed-pdf";
import { overdueAndPenaltyAction } from "../actions/overdue-and-penalty.action";
import { sendReminderAction } from "@/features/notifications/actions/send-reminder.action";
import { deleteLoanAction } from "@/features/loans/actions/delete-loan.action";
import { deleteBorrowerAction } from "@/features/borrowers/actions/delete-borrower.action";
import { updateBorrowerAction } from "@/features/borrowers/actions/update-borrower.action";
import { getFundersQuickListAction, type FunderQuickOption } from "@/features/capital/actions/get-funders-quick-list.action";
import { reassignCapitalSourceAction } from "@/features/capital/actions/reassign-capital-source.action";
import type { LoanManagementDetailResult } from "../actions/get-loan-management-data.action";
import { calculatePeriods, calculateMonthlyInterest } from "@/domain/interest-calculator";
import { generateActiveLoansPdf } from "../utils/generate-active-loans-pdf";
import { generateCurrentStatementPdf } from "../utils/generate-current-statement-pdf";
import { differenceInDays, format } from "date-fns";
import { FinexaCard3D, FinexaStaggerContainer, FinexaStaggerItem } from "@/components/motion/finexa-motion";
import { FinexaMoneyEffect, FinexaCycleEffect, FinexaDocumentEffect } from "@/components/motion/finexa-effects";
import { LoanCardItem } from "./loan-card-item";
import { VirtualizedLoanList } from "./virtualized-loan-list";
import {
  Search, Plus, Send, Landmark, Calendar, RefreshCw, CreditCard, ChevronRight,
  Trash2, Users, Mail, FileText, MapPin, User, Eye, EyeOff, Edit, Clock,
  AlertTriangle, Check, CheckCircle2, XCircle, ChevronDown, ListFilter, X,
  ShieldAlert, Settings, Percent, DollarSign, History, ExternalLink, Coins, ArrowLeftRight,
  LayoutGrid, List
} from "lucide-react";

// ── Lazy-Loaded Heavy Modals (Code Splitting / Frontend Optimization) ───────────
const DetailedAuditModal = dynamic(
  () => import("./modals/detailed-audit-modal").then((m) => m.DetailedAuditModal),
  { ssr: false }
);

const RecordPaymentModal = dynamic(
  () => import("./modals/record-payment-modal").then((m) => m.RecordPaymentModal),
  { ssr: false }
);

const SendReminderModal = dynamic(
  () => import("./modals/send-reminder-modal").then((m) => m.SendReminderModal),
  { ssr: false }
);

const ExtendLoanModal = dynamic(
  () => import("./modals/extend-loan-modal").then((m) => m.ExtendLoanModal),
  { ssr: false }
);

const EditBorrowerModal = dynamic(
  () => import("./modals/edit-borrower-modal").then((m) => m.EditBorrowerModal),
  { ssr: false }
);

const ReassignCapitalModal = dynamic(
  () => import("./modals/reassign-capital-modal").then((m) => m.ReassignCapitalModal),
  { ssr: false }
);

const AllocateCapitalDialog = dynamic(
  () => import("./allocate-capital-dialog").then((m) => m.AllocateCapitalDialog),
  { ssr: false }
);

interface LoanManagementListProps {
  initialLoans: LoanManagementDetailResult[];
}

export function LoanManagementList({ initialLoans }: LoanManagementListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Optimistic local state for loans
  const [loans, setLoans] = useState<LoanManagementDetailResult[]>(initialLoans);
  const [isPending, startTransition] = useTransition();

  // Keep local loans state synced with initialLoans when React Query updates
  useEffect(() => {
    setLoans(initialLoans);
  }, [initialLoans]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generatingStatementId, setGeneratingStatementId] = useState<string | null>(null);

  // Pagination State (Requirement 3: Paginate large lists to prevent DOM explosion)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [viewMode, setViewMode] = useState<"virtualized" | "grid">("virtualized");

  // Motion effects
  const [showMoneyEffect, setShowMoneyEffect] = useState(false);
  const [showCycleEffect, setShowCycleEffect] = useState(false);
  const [showDocEffect, setShowDocEffect] = useState(false);

  // Dialog States
  const [selectedLoan, setSelectedLoan] = useState<LoanManagementDetailResult | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [loanToAllocate, setLoanToAllocate] = useState<LoanManagementDetailResult | null>(null);

  // Capital Source Switcher
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignLoan, setReassignLoan] = useState<LoanManagementDetailResult | null>(null);
  const [reassignAllocationId, setReassignAllocationId] = useState<string>("");
  const [reassignAmount, setReassignAmount] = useState<number>(0);
  const [reassignOldFunderName, setReassignOldFunderName] = useState<string>("");
  const [reassignFunders, setReassignFunders] = useState<FunderQuickOption[]>([]);
  const [reassignSelectedFunderId, setReassignSelectedFunderId] = useState<string>("");
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // Payment inputs
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

  const todayStr = new Date().toISOString().split("T")[0]!;
  const today = new Date(todayStr);

  // Auto-open modal from URL query
  useEffect(() => {
    const action = searchParams.get("action");
    const loanId = searchParams.get("loanId");

    if (action && loanId && loans.length > 0) {
      const targetLoan = loans.find((l) => l.loanId === loanId);
      if (targetLoan) {
        setSelectedLoan(targetLoan);
        if (action === "pay") {
          setPaymentAmount("");
          setPaymentNotes("");
          setPaymentActionMode("record");
          setPaymentType("interest");
          setPaymentOpen(true);
        } else if (action === "extend") {
          setExtendOpen(true);
        } else if (action === "remind") {
          setPenaltyAmount("0");
          setReminderOpen(true);
        } else if (action === "details") {
          setDetailsOpen(true);
        }
      }
    }
  }, [searchParams, loans]);

  // Filtered & Sorted Loans
  const filteredLoans = useMemo(() => {
    return loans
      .filter((loan) => {
        const isPaid = loan.outstandingBalance <= 0 || loan.status === "closed";
        const isDueToday = loan.dueDate === todayStr;
        const isOverdue = loan.status === "overdue" || (new Date(loan.dueDate) < today && !isPaid);

        let dynamicStatus = "active";
        if (isPaid) dynamicStatus = "paid";
        else if (isDueToday) dynamicStatus = "due_today";
        else if (isOverdue) dynamicStatus = "overdue";

        if (statusFilter === "active" && dynamicStatus !== "active") return false;
        if (statusFilter === "due_today" && dynamicStatus !== "due_today") return false;
        if (statusFilter === "overdue" && dynamicStatus !== "overdue") return false;
        if (statusFilter === "paid" && dynamicStatus !== "paid") return false;

        if (deferredSearch.trim()) {
          const q = deferredSearch.toLowerCase();
          const matchName = loan.borrower.name.toLowerCase().includes(q);
          const matchMobile = loan.borrower.mobile.includes(q);
          const matchPan = loan.borrower.panDecrypted?.toLowerCase().includes(q);
          const matchAadhaar = loan.borrower.aadhaarDecrypted?.includes(q);
          const matchFunder = loan.funding?.sources.some((s) => s.funderName.toLowerCase().includes(q));
          if (!matchName && !matchMobile && !matchPan && !matchAadhaar && !matchFunder) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.dateGiven).getTime() - new Date(a.dateGiven).getTime();
        if (sortBy === "oldest") return new Date(a.dateGiven).getTime() - new Date(b.dateGiven).getTime();
        if (sortBy === "highest_amount") return Number(b.principal) - Number(a.principal);
        if (sortBy === "lowest_amount") return Number(a.principal) - Number(b.principal);
        if (sortBy === "due_date") return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (sortBy === "borrower_name") return a.borrower.name.localeCompare(b.borrower.name);
        return 0;
      });
  }, [loans, deferredSearch, statusFilter, sortBy, today, todayStr]);

  // Total pages and paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / pageSize));
  const paginatedLoans = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLoans.slice(start, start + pageSize);
  }, [filteredLoans, currentPage, pageSize]);

  // Adjust current page if search/filter narrows results
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // ── Memoized Callbacks (Requirement 2: Prevent unnecessary re-renders) ────────
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((val: string) => {
    setSortBy(val || "newest");
    setCurrentPage(1);
  }, []);

  const handlePageSizeChange = useCallback((val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  }, []);

  const handlePay = useCallback((loan: LoanManagementDetailResult) => {
    setSelectedLoan(loan);
    setPaymentAmount("");
    setPaymentNotes("");
    setPaymentActionMode("record");
    setPaymentType("interest");
    setPaymentOpen(true);
  }, []);

  const handleViewDetails = useCallback((loan: LoanManagementDetailResult) => {
    setSelectedLoan(loan);
    setDetailsOpen(true);
  }, []);

  const handleEditOpen = useCallback((loan: LoanManagementDetailResult, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedLoan(loan);
    setBorrowerName(loan.borrower.name);
    setBorrowerMobile(loan.borrower.mobile);
    setBorrowerEmail(loan.borrower.email || "");
    setBorrowerPan(loan.borrower.panDecrypted || "");
    setBorrowerAadhaar(loan.borrower.aadhaarDecrypted || "");
    setBorrowerLocation(loan.borrower.locationUrl || "");
    setEditOpen(true);
  }, []);

  const handleAllocateCapital = useCallback((loan: LoanManagementDetailResult) => {
    setLoanToAllocate(loan);
    setAllocateOpen(true);
  }, []);

  const handleOpenReassign = useCallback(
    async (
      loan: LoanManagementDetailResult,
      allocationId: string,
      amount: number,
      funderName: string,
      e: React.MouseEvent
    ) => {
      e.stopPropagation();
      setReassignLoan(loan);
      setReassignAllocationId(allocationId);
      setReassignAmount(amount);
      setReassignOldFunderName(funderName);
      setReassignSelectedFunderId("");
      setReassignOpen(true);
      setReassignLoading(true);

      try {
        const res = await getFundersQuickListAction();
        if (res.success && res.data) {
          setReassignFunders(res.data.filter((f) => f.name !== funderName));
        } else {
          toast.error("Failed to load available capital persons.");
        }
      } catch {
        toast.error("Failed to load funders.");
      } finally {
        setReassignLoading(false);
      }
    },
    []
  );

  const handleConfirmReassign = useCallback(async () => {
    if (!reassignLoan || !reassignAllocationId || !reassignSelectedFunderId) {
      toast.error("Please select a new capital person.");
      return;
    }

    setReassignSubmitting(true);
    try {
      const res = await reassignCapitalSourceAction({
        loanId: reassignLoan.loanId,
        allocationId: reassignAllocationId,
        newFunderId: reassignSelectedFunderId,
        amount: reassignAmount,
      });

      if (res.success) {
        toast.success("Capital source reassigned successfully!");
        setReassignOpen(false);
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to reassign capital source.");
      }
    } catch {
      toast.error("An unexpected error occurred while reassigning capital.");
    } finally {
      setReassignSubmitting(false);
    }
  }, [reassignLoan, reassignAllocationId, reassignSelectedFunderId, reassignAmount, queryClient]);

  const handleDeleteLoan = useCallback(
    (loanId: string, borrowerName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`Are you sure you want to permanently delete the loan file for "${borrowerName}"? This action cannot be undone.`)) {
        return;
      }

      startTransition(async () => {
        setLoans((prev) => prev.filter((l) => l.loanId !== loanId));
        queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (old) => {
          if (!old) return [];
          return old.filter((l) => l.loanId !== loanId);
        });

        const res = await deleteLoanAction(loanId);
        if (res.success) {
          toast.success(`Loan file for "${borrowerName}" was deleted.`);
          queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Failed to delete loan.");
          queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        }
      });
    },
    [queryClient]
  );

  const handleDeleteBorrower = useCallback(
    (borrowerId: string, borrowerName: string) => {
      if (!confirm(`⚠️ CRITICAL: Are you sure you want to delete borrower "${borrowerName}" and ALL their associated loans, repayments, reminders, and documents? This is irreversible.`)) {
        return;
      }

      startTransition(async () => {
        setLoans((prev) => prev.filter((l) => l.borrowerId !== borrowerId));
        queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (old) => {
          if (!old) return [];
          return old.filter((l) => l.borrowerId !== borrowerId);
        });
        setDetailsOpen(false);

        const res = await deleteBorrowerAction(borrowerId);
        if (res.success) {
          toast.success(`Borrower "${borrowerName}" and all associated loans have been permanently deleted.`);
          queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Failed to delete borrower.");
          queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        }
      });
    },
    [queryClient]
  );

  const handleCurrentStatement = useCallback((loan: LoanManagementDetailResult) => {
    setGeneratingStatementId(loan.loanId);
    setTimeout(() => {
      try {
        const principal = Number(loan.principal);
        const interestRate = Number(loan.interestRate);
        const monthlyInterestAmount = calculateMonthlyInterest(principal, interestRate);
        const periods = calculatePeriods(loan.dateGiven, loan.dueDate, loan.interestType as any);
        const totalInterest = monthlyInterestAmount * Math.max(1, periods);

        const now = new Date();
        const dueDateObj = new Date(loan.dueDate);
        const isOverdue = now > dueDateObj && loan.status !== "closed";
        const overdueDays = isOverdue ? Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const daysRemaining = !isOverdue ? Math.max(0, Math.ceil((dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

        const penaltyRatePerThousand = Number((loan as any).penaltyRate || 20);
        const calculatedPenalty = isOverdue ? (principal / 1000) * penaltyRatePerThousand * overdueDays : 0;
        const accruedPenalty = {
          totalPenalty: calculatedPenalty,
          isPenaltyActive: isOverdue && calculatedPenalty > 0,
        };

        const totalPayments = principal + totalInterest + Number(loan.penaltyAmount || 0) - loan.outstandingBalance;
        const totalPayable = loan.outstandingBalance;

        const nowFormatted = format(new Date(), "dd MMM yyyy, hh:mm a");
        const docId = `FIN-CST-${format(new Date(), "yyyyMMdd")}-${Math.floor(100000 + Math.random() * 900000)}`;

        generateCurrentStatementPdf({
          documentId: docId,
          statementDate: nowFormatted,
          loanId: loan.loanId,
          borrowerName: loan.borrower.name,
          mobile: loan.borrower.mobile,
          email: loan.borrower.email || undefined,
          panDecrypted: loan.borrower.panDecrypted,
          aadhaarDecrypted: loan.borrower.aadhaarDecrypted,
          locationUrl: loan.borrower.locationUrl || undefined,
          principal,
          interestRate,
          interestType: loan.interestType as any,
          dateGiven: loan.dateGiven,
          dueDate: loan.dueDate,
          status: loan.status,
          penaltyRate: Number((loan as any).penaltyRate || 20),
          manualPenaltyAmount: Number(loan.penaltyAmount || 0),
          monthlyInterestAmount,
          totalInterest,
          accruedPenalty: accruedPenalty.totalPenalty,
          isPenaltyActive: accruedPenalty.isPenaltyActive,
          overdueDays,
          daysRemaining,
          isOverdue,
          totalPayments,
          outstandingBalance: loan.outstandingBalance,
          totalPayable,
          payments: [],
          cycles: [],
          notes: (loan as any).notes || undefined,
        });

        toast.success("Current Statement PDF generated & downloaded!");
      } catch (err: any) {
        console.error("Current Statement PDF Error:", err);
        toast.error("Unable to generate the current statement. Please try again.");
      } finally {
        setGeneratingStatementId(null);
      }
    }, 100);
  }, []);

  const handleDownloadPdf = useCallback(() => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      try {
        generateActiveLoansPdf(filteredLoans);
        toast.success("Active Loans PDF generated & downloaded!");
      } catch (err: any) {
        console.error("PDF Export Error:", err);
        toast.error("Unable to generate PDF. Please try again.");
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 100);
  }, [filteredLoans]);

  // Form Submissions
  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedLoan) return;

      const fd = new FormData();
      fd.append("borrowerId", selectedLoan.borrowerId);
      fd.append("name", borrowerName);
      fd.append("mobile", borrowerMobile);
      fd.append("email", borrowerEmail);
      fd.append("pan", borrowerPan);
      fd.append("aadhaar", borrowerAadhaar);
      fd.append("locationUrl", borrowerLocation);

      startTransition(async () => {
        const res = await updateBorrowerAction(null, fd);
        if (res.success) {
          toast.success("Borrower details updated successfully!");
          setEditOpen(false);
          queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Failed to update borrower details");
        }
      });
    },
    [selectedLoan, borrowerName, borrowerMobile, borrowerEmail, borrowerPan, borrowerAadhaar, borrowerLocation, queryClient]
  );

  const handlePaymentSubmit = useCallback(
    async (e: React.FormEvent) => {
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

      const paidAmt = Number(paymentAmount);
      if (isNaN(paidAmt) || paidAmt <= 0) {
        toast.error("Please enter a valid payment amount.");
        return;
      }

      const fd = new FormData();
      fd.append("loanId", selectedLoan.loanId);
      fd.append("amount", paymentAmount);
      fd.append("paymentType", paymentType);
      fd.append("paymentDate", paymentDate);
      fd.append("notes", paymentNotes);

      const targetLoanId = selectedLoan.loanId;
      const previousOutstanding = selectedLoan.outstandingBalance;
      const previousStatus = selectedLoan.status;
      const newBal = Math.max(0, previousOutstanding - paidAmt);
      const newStatus = newBal === 0 ? "closed" : previousStatus;

      // 1. Cancel in-flight queries & snapshot previous data for rollback
      await queryClient.cancelQueries({ queryKey: LOANS_QUERY_KEY });
      const previousLoans = queryClient.getQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY);

      // 2. Instant optimistic update in local state and TanStack Query cache
      setLoans((prev) =>
        prev.map((l) => (l.loanId === targetLoanId ? { ...l, outstandingBalance: newBal, status: newStatus } : l))
      );
      setSelectedLoan((prev) => (prev ? { ...prev, outstandingBalance: newBal, status: newStatus } : prev));
      queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (old) => {
        if (!old) return [];
        return old.map((l) => (l.loanId === targetLoanId ? { ...l, outstandingBalance: newBal, status: newStatus } : l));
      });

      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setShowMoneyEffect(true);

      startTransition(async () => {
        const res = await recordPaymentAction(null, fd);
        if (res.success) {
          toast.success("Payment recorded successfully!");
          queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
        } else {
          // Rollback on failure
          if (previousLoans) {
            queryClient.setQueryData(LOANS_QUERY_KEY, previousLoans);
            setLoans(previousLoans);
          }
          toast.error(typeof res.error === "string" ? res.error : "Failed to record payment.");
        }
      });
    },
    [selectedLoan, paymentActionMode, paymentAmount, paymentType, paymentDate, paymentNotes, queryClient]
  );

  const handlePayAndExtendConfirm = async () => {
    if (!selectedLoan) return;
    const targetLoanId = selectedLoan.loanId;

    await queryClient.cancelQueries({ queryKey: LOANS_QUERY_KEY });
    const previousLoans = queryClient.getQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY);

    // Compute optimistic new due date (+1 month)
    const currentDue = new Date(selectedLoan.dueDate);
    const optimisticDueDate = new Date(currentDue.setMonth(currentDue.getMonth() + 1)).toISOString().split("T")[0]!;

    // 1. Instant optimistic update
    setLoans((prev) =>
      prev.map((l) => (l.loanId === targetLoanId ? { ...l, dueDate: optimisticDueDate, status: "active" } : l))
    );
    setSelectedLoan((prev) => (prev ? { ...prev, dueDate: optimisticDueDate, status: "active" } : prev));
    queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (old) => {
      if (!old) return [];
      return old.map((l) => (l.loanId === targetLoanId ? { ...l, dueDate: optimisticDueDate, status: "active" } : l));
    });

    setPaymentOpen(false);
    setShowCycleEffect(true);
    setTimeout(() => setShowCycleEffect(false), 2000);

    startTransition(async () => {
      const res = await payAndExtendAction(
        selectedLoan.loanId,
        paymentDate,
        paymentNotes || "Monthly Interest Paid & Cycle Extended"
      );

      if (res.success) {
        toast.success(`Success! Interest of ₹${res.data.amountPaid.toLocaleString("en-IN")} recorded.`);
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
      } else {
        if (previousLoans) {
          queryClient.setQueryData(LOANS_QUERY_KEY, previousLoans);
          setLoans(previousLoans);
        }
        toast.error(typeof res.error === "string" ? res.error : "Pay & Extend operation failed.");
      }
    });
  };

  const handleOverduePenaltyConfirm = async () => {
    if (!selectedLoan) return;
    const targetLoanId = selectedLoan.loanId;

    await queryClient.cancelQueries({ queryKey: LOANS_QUERY_KEY });
    const previousLoans = queryClient.getQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY);

    const now = new Date();
    const optimisticDueDate = new Date(now.setMonth(now.getMonth() + 1)).toISOString().split("T")[0]!;

    // 1. Instant optimistic update
    setLoans((prev) =>
      prev.map((l) => (l.loanId === targetLoanId ? { ...l, dueDate: optimisticDueDate, status: "active", penaltyAmount: "0" } : l))
    );
    setSelectedLoan((prev) => (prev ? { ...prev, dueDate: optimisticDueDate, status: "active", penaltyAmount: "0" } : prev));
    queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (old) => {
      if (!old) return [];
      return old.map((l) => (l.loanId === targetLoanId ? { ...l, dueDate: optimisticDueDate, status: "active", penaltyAmount: "0" } : l));
    });

    setPaymentOpen(false);
    setShowCycleEffect(true);
    setTimeout(() => setShowCycleEffect(false), 2000);

    startTransition(async () => {
      const res = await overdueAndPenaltyAction(
        selectedLoan.loanId,
        paymentDate,
        paymentNotes || "Overdue Interest & Penalty Paid - Cycle Reset"
      );

      if (res.success) {
        toast.success(`Overdue Cleared! Interest: ₹${res.data.interestPaid}, Penalty: ₹${res.data.penaltyPaid}.`);
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
      } else {
        if (previousLoans) {
          queryClient.setQueryData(LOANS_QUERY_KEY, previousLoans);
          setLoans(previousLoans);
        }
        toast.error(typeof res.error === "string" ? res.error : "Overdue settlement failed.");
      }
    });
  };

  const handleExtendConfirm = async () => {
    if (!selectedLoan) return;
    const targetLoanId = selectedLoan.loanId;

    await queryClient.cancelQueries({ queryKey: LOANS_QUERY_KEY });
    const previousLoans = queryClient.getQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY);

    const currentDue = new Date(selectedLoan.dueDate);
    const optimisticDueDate = new Date(currentDue.setMonth(currentDue.getMonth() + 1)).toISOString().split("T")[0]!;

    // 1. Instant optimistic update
    setLoans((prev) =>
      prev.map((l) => (l.loanId === targetLoanId ? { ...l, dueDate: optimisticDueDate } : l))
    );
    setSelectedLoan((prev) => (prev ? { ...prev, dueDate: optimisticDueDate } : prev));
    queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (old) => {
      if (!old) return [];
      return old.map((l) => (l.loanId === targetLoanId ? { ...l, dueDate: optimisticDueDate } : l));
    });

    setExtendOpen(false);

    startTransition(async () => {
      const res = await extendLoanAction(selectedLoan.loanId);
      if (res.success) {
        toast.success(`Loan extended! New Due Date: ${res.data.newDueDate}`);
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
      } else {
        if (previousLoans) {
          queryClient.setQueryData(LOANS_QUERY_KEY, previousLoans);
          setLoans(previousLoans);
        }
        toast.error(typeof res.error === "string" ? res.error : "Failed to extend loan.");
      }
    });
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    setReminderOpen(false);
    startTransition(async () => {
      const res = await sendReminderAction(selectedLoan.loanId, Number(penaltyAmount) || 0);
      if (res.success) {
        toast.success("Reminder alerts dispatched via SMS & Email!");
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to dispatch reminder.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Visual Transition Effects */}
      <FinexaMoneyEffect active={showMoneyEffect} onComplete={() => setShowMoneyEffect(false)} />
      <FinexaCycleEffect active={showCycleEffect} />
      <FinexaDocumentEffect active={showDocEffect} />

      {/* ── Search, Filters & Action Controls (Architecture 3: Segmented Tab Group + Dedicated Search Bar) ── */}
      <div className="flex flex-col gap-3">
        {/* 1. Top Action Row (Search & Sort + Action Buttons) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          {/* Search Input Field */}
          <div className="relative flex-1 w-full max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by borrower name, mobile, PAN, Aadhaar, capital person..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-[#27272a] border border-zinc-700/60 text-zinc-100 placeholder-zinc-500 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#eab308] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5 rounded-md"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right Action Group (Sort Dropdown & Buttons) */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(val) => handleSortChange(val || "newest")}>
              <SelectTrigger className="w-full sm:w-auto min-w-[140px] bg-[#27272a] border border-zinc-700/60 text-zinc-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold h-auto focus:ring-0 focus:border-[#eab308] focus:ring-offset-0 outline-none">
                <SelectValue placeholder="Sort Options" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-zinc-800 bg-[#18181b] text-zinc-200 z-50">
                <SelectItem value="newest" className="text-xs text-zinc-300 focus:bg-[#27272a] focus:text-zinc-100 cursor-pointer">Newest First</SelectItem>
                <SelectItem value="oldest" className="text-xs text-zinc-300 focus:bg-[#27272a] focus:text-zinc-100 cursor-pointer">Oldest First</SelectItem>
                <SelectItem value="highest_amount" className="text-xs text-zinc-300 focus:bg-[#27272a] focus:text-zinc-100 cursor-pointer">Highest Amount</SelectItem>
                <SelectItem value="lowest_amount" className="text-xs text-zinc-300 focus:bg-[#27272a] focus:text-zinc-100 cursor-pointer">Lowest Amount</SelectItem>
                <SelectItem value="due_date" className="text-xs text-zinc-300 focus:bg-[#27272a] focus:text-zinc-100 cursor-pointer">Due Date</SelectItem>
                <SelectItem value="borrower_name" className="text-xs text-zinc-300 focus:bg-[#27272a] focus:text-zinc-100 cursor-pointer">Borrower (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            {/* Download Active Loans PDF Button */}
            <Button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="h-10 px-3.5 rounded-xl gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isGeneratingPdf ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
                  <span className="hidden sm:inline">Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Download Active Loans PDF</span>
                  <span className="sm:hidden">PDF</span>
                </>
              )}
            </Button>

            {/* New Loan */}
            <Link href="/loans/new" className="shrink-0">
              <Button className="h-10 px-4 rounded-xl gap-1.5 fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable text-xs font-bold whitespace-nowrap">
                <Plus className="h-3.5 w-3.5" />
                <span>New Loan</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* 2. Bottom Row (Segmented Filter Tab Group) */}
        <div className="w-full overflow-x-auto py-2 scrollbar-none">
          <div className="inline-flex items-center gap-1.5 p-1.5 bg-[#18181b] border border-zinc-800 rounded-xl min-w-full sm:min-w-0">
            {[
              { id: "all", label: "ALL LOANS", count: loans.length },
              {
                id: "active",
                label: "ACTIVE",
                count: loans.filter((l) => l.outstandingBalance > 0 && l.status !== "closed" && l.dueDate !== todayStr && !(new Date(l.dueDate) < today)).length,
              },
              {
                id: "due_today",
                label: "DUE TODAY",
                count: loans.filter((l) => l.dueDate === todayStr && l.outstandingBalance > 0 && l.status !== "closed").length,
              },
              {
                id: "overdue",
                label: "OVERDUE",
                count: loans.filter((l) => (l.status === "overdue" || new Date(l.dueDate) < today) && l.outstandingBalance > 0 && l.status !== "closed").length,
              },
              {
                id: "paid",
                label: "SETTLED",
                count: loans.filter((l) => l.outstandingBalance <= 0 || l.status === "closed").length,
              },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleStatusFilterChange(tab.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? "bg-zinc-800/90 text-yellow-400 border border-yellow-500/30 shadow-sm shadow-yellow-500/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      isActive
                        ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Status Bar / Stats & View Mode Toggle ─────────────────────────── */}
      <div className="text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
        {isPending ? (
          <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Synchronizing changes...</span>
        ) : (
          <span>Showing {filteredLoans.length} of {loans.length} loan portfolio{loans.length !== 1 ? "s" : ""}</span>
        )}

        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#18181b] border border-zinc-800">
          <button
            type="button"
            onClick={() => setViewMode("virtualized")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              viewMode === "virtualized"
                ? "bg-zinc-800/90 text-yellow-400 border border-yellow-500/30 shadow-sm shadow-yellow-500/10"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
            }`}
            title="60 FPS Virtualized List View"
          >
            <List className="h-3.5 w-3.5" />
            <span>Virtual List (60 FPS)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              viewMode === "grid"
                ? "bg-zinc-800/90 text-yellow-400 border border-yellow-500/30 shadow-sm shadow-yellow-500/10"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
            }`}
            title="Grid View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Grid</span>
          </button>
        </div>
      </div>

      {/* ── Virtualized List or Cards Grid ─────────────────────────────────── */}
      {viewMode === "virtualized" ? (
        <VirtualizedLoanList
          loans={filteredLoans}
          onSelectLoan={handleViewDetails}
        />
      ) : (
        <>
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
              {paginatedLoans.map((loan) => (
                <LoanCardItem
                  key={loan.loanId}
                  loan={loan}
                  onPay={handlePay}
                  onViewDetails={handleViewDetails}
                  onEditOpen={handleEditOpen}
                  onDeleteLoan={handleDeleteLoan}
                  onCurrentStatement={handleCurrentStatement}
                  onOpenReassign={handleOpenReassign}
                  onAllocateCapital={handleAllocateCapital}
                  generatingStatementId={generatingStatementId}
                  isPending={isPending}
                />
              ))}
            </div>
          )}

          {/* ── Pagination Controls (Grid View) ───────────────────────────── */}
          {filteredLoans.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <span>
                  Showing <strong className="text-zinc-200">{(currentPage - 1) * pageSize + 1}</strong> – <strong className="text-zinc-200">{Math.min(currentPage * pageSize, filteredLoans.length)}</strong> of <strong className="text-zinc-200">{filteredLoans.length}</strong> loans
                </span>
                <span className="text-zinc-600">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-amber-500"
                  >
                    <option value={6}>6</option>
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={48}>48</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-3 rounded-lg text-xs font-bold border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-40"
                  >
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .map((page, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={page}>
                            {prev && page - prev > 1 && <span className="px-1 text-zinc-500">...</span>}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`h-8 w-8 rounded-lg font-bold text-xs transition-colors ${
                                currentPage === page
                                  ? "bg-amber-500 text-zinc-900 shadow-sm"
                                  : "bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700/60"
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-3 rounded-lg text-xs font-bold border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-40"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Dynamically Loaded Lazy Modals (Code Splitting) ──────────────────── */}
      {paymentOpen && (
        <RecordPaymentModal
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          loan={selectedLoan}
          paymentActionMode={paymentActionMode}
          setPaymentActionMode={setPaymentActionMode}
          paymentAmount={paymentAmount}
          setPaymentAmount={setPaymentAmount}
          paymentType={paymentType}
          setPaymentType={setPaymentType}
          paymentDate={paymentDate}
          setPaymentDate={setPaymentDate}
          paymentNotes={paymentNotes}
          setPaymentNotes={setPaymentNotes}
          onSubmit={handlePaymentSubmit}
          isPending={isPending}
        />
      )}

      {reminderOpen && (
        <SendReminderModal
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          loan={selectedLoan}
          penaltyAmount={penaltyAmount}
          setPenaltyAmount={setPenaltyAmount}
          onSubmit={handleReminderSubmit}
          isPending={isPending}
        />
      )}

      {extendOpen && (
        <ExtendLoanModal
          open={extendOpen}
          onOpenChange={setExtendOpen}
          loan={selectedLoan}
          onConfirm={handleExtendConfirm}
          isPending={isPending}
        />
      )}

      {editOpen && (
        <EditBorrowerModal
          open={editOpen}
          onOpenChange={setEditOpen}
          loan={selectedLoan}
          borrowerName={borrowerName}
          setBorrowerName={setBorrowerName}
          borrowerMobile={borrowerMobile}
          setBorrowerMobile={setBorrowerMobile}
          borrowerEmail={borrowerEmail}
          setBorrowerEmail={setBorrowerEmail}
          borrowerPan={borrowerPan}
          setBorrowerPan={setBorrowerPan}
          borrowerAadhaar={borrowerAadhaar}
          setBorrowerAadhaar={setBorrowerAadhaar}
          borrowerLocation={borrowerLocation}
          setBorrowerLocation={setBorrowerLocation}
          onSubmit={handleEditSubmit}
          isPending={isPending}
        />
      )}

      {detailsOpen && (
        <DetailedAuditModal
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          loan={selectedLoan}
          onEditKyc={(loan) => handleEditOpen(loan)}
          onAllocateCapital={(loan) => handleAllocateCapital(loan)}
          onDeleteBorrower={handleDeleteBorrower}
          isDeletingBorrower={isPending}
        />
      )}

      {allocateOpen && (
        <AllocateCapitalDialog
          open={allocateOpen}
          onOpenChange={setAllocateOpen}
          loan={loanToAllocate}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
          }}
        />
      )}

      {reassignOpen && (
        <ReassignCapitalModal
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          loan={reassignLoan}
          reassignAmount={reassignAmount}
          reassignOldFunderName={reassignOldFunderName}
          reassignFunders={reassignFunders}
          reassignSelectedFunderId={reassignSelectedFunderId}
          setReassignSelectedFunderId={setReassignSelectedFunderId}
          reassignLoading={reassignLoading}
          reassignSubmitting={reassignSubmitting}
          onConfirm={handleConfirmReassign}
        />
      )}
    </div>
  );
}
