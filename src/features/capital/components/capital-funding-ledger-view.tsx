"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFunderLedgerAction,
  type FunderLedgerData,
  type LedgerTransactionItem,
} from "../actions/get-funder-ledger.action";
import { recordReceivedCapitalAction } from "../actions/record-received-capital.action";
import { recordCapitalReturnAction } from "../actions/record-capital-return.action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Coins,
  Search,
  Calendar,
  ExternalLink,
  RefreshCw,
  User,
  Phone,
  ArrowDownRight,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  Receipt,
  Layers,
  ChevronLeft,
  ChevronRight,
  Landmark,
  BadgeCheck,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

interface CapitalFundingLedgerViewProps {
  funderId: string;
  initialData?: FunderLedgerData | null;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("en-IN");
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function CapitalFundingLedgerView({
  funderId,
  initialData,
}: CapitalFundingLedgerViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Query funder ledger
  const { data, isLoading, isFetching, refetch, error: queryError } = useQuery({
    queryKey: ["capital-funder-ledger", funderId],
    queryFn: async () => {
      const res = await getFunderLedgerAction(funderId);
      if (!res.success) {
        const errMsg = typeof res.error === "string" ? res.error : "Failed to load funder ledger";
        throw new Error(errMsg);
      }
      return res.data;
    },
    initialData: initialData || undefined,
    staleTime: 1000 * 60 * 2,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const isDbConnectionError =
    queryError instanceof Error &&
    (queryError.message.includes("DB_CONNECTION_ERROR") ||
      queryError.message.includes("ECONNRESET") ||
      queryError.message.includes("Failed query") ||
      queryError.message.includes("Connection terminated"));

  // Filters & Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount_desc" | "amount_asc" | "borrower">("newest");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Active view tab (Funding Transactions vs Payments To Funder vs Borrower Repayments)
  const [activeLedgerTab, setActiveLedgerTab] = useState<"funding" | "payments_to_funder" | "borrower_repayments">("funding");

  // Dialog state: Transaction Details
  const [selectedTx, setSelectedTx] = useState<LedgerTransactionItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Dialog state: Record Capital Received
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordAmount, setRecordAmount] = useState("");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]!);
  const [recordNotes, setRecordNotes] = useState("");
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);

  // Dialog state: Pay Capital Person
  const [payPersonOpen, setPayPersonOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]!);
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const funder = data?.funder;
  const metrics = data?.metrics || {
    totalProvided: 0,
    totalAllocated: 0,
    currentlyAllocated: 0,
    returnedFromBorrower: 0,
    paidBackToCapitalPerson: 0,
    capitalPayable: 0,
    unallocatedReceived: 0,
    totalReturned: 0,
    transactionCount: 0,
    status: "ACTIVE",
  };

  // Effective payable amount: guaranteed to recognize unallocated capital even if cached data has stale stats
  const effectivePayable = Math.max(
    0,
    Number(metrics.capitalPayable ?? 0) > 0
      ? Number(metrics.capitalPayable)
      : Math.max(0, (Number(metrics.unallocatedReceived) || 0) + (Number(metrics.returnedFromBorrower) || 0) - (Number(metrics.paidBackToCapitalPerson) || 0)) ||
        Math.max(0, (Number(metrics.totalProvided) || 0) - (Number(metrics.currentlyAllocated) || 0) - (Number(metrics.paidBackToCapitalPerson) || 0))
  );

  const rawTransactions = data?.transactions || [];
  const paymentsToCapitalPerson = data?.paymentsToCapitalPerson || [];
  const borrowerRepayments = data?.borrowerRepayments || [];

  // Filter & Search logic
  const filteredTransactions = useMemo(() => {
    let list = [...rawTransactions];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((tx) => {
        const codeMatch = tx.transactionCode?.toLowerCase().includes(q);
        const borrowerMatch = tx.borrowerName?.toLowerCase().includes(q);
        const mobileMatch = tx.borrowerMobile?.toLowerCase().includes(q);
        const loanMatch = tx.loanCode?.toLowerCase().includes(q) || tx.loanId?.toLowerCase().includes(q);
        const notesMatch = tx.notes?.toLowerCase().includes(q);
        return codeMatch || borrowerMatch || mobileMatch || loanMatch || notesMatch;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "allocated") {
        list = list.filter((tx) => tx.status === "allocated" || tx.type === "FUNDING");
      } else if (statusFilter === "partially_returned") {
        list = list.filter((tx) => tx.status === "partially_returned");
      } else if (statusFilter === "returned") {
        list = list.filter((tx) => tx.status === "returned" || tx.currentlyAllocated === 0);
      } else if (statusFilter === "advance") {
        list = list.filter((tx) => tx.type === "ADVANCE" || (tx.status === "received" && !tx.loanId));
      } else if (statusFilter === "released") {
        list = list.filter((tx) => tx.status === "released" || tx.type === "RETURN");
      } else {
        list = list.filter((tx) => tx.status === statusFilter);
      }
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0]!;

      if (dateFilter === "today") {
        list = list.filter((tx) => tx.fundingDate === todayStr);
      } else if (dateFilter === "last7") {
        const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split("T")[0]!;
        list = list.filter((tx) => tx.fundingDate >= d7 && tx.fundingDate <= todayStr);
      } else if (dateFilter === "thisMonth") {
        const ym = todayStr.slice(0, 7);
        list = list.filter((tx) => tx.fundingDate?.startsWith(ym));
      } else if (dateFilter === "custom" && customStartDate && customEndDate) {
        list = list.filter((tx) => tx.fundingDate >= customStartDate && tx.fundingDate <= customEndDate);
      }
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.fundingDate).getTime() - new Date(a.fundingDate).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.fundingDate).getTime() - new Date(b.fundingDate).getTime();
      }
      if (sortBy === "amount_desc") {
        return (b.originalAmount || b.amount) - (a.originalAmount || a.amount);
      }
      if (sortBy === "amount_asc") {
        return (a.originalAmount || a.amount) - (b.originalAmount || b.amount);
      }
      if (sortBy === "borrower") {
        const nameA = a.borrowerName || "";
        const nameB = b.borrowerName || "";
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    return list;
  }, [rawTransactions, searchTerm, statusFilter, dateFilter, customStartDate, customEndDate, sortBy]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredTransactions.slice(startIndex, startIndex + pageSize);
  }, [filteredTransactions, safeCurrentPage, pageSize]);

  // Filtered totals
  const filteredProvidedSum = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === "FUNDING" || t.type === "ADVANCE")
      .reduce((sum, t) => sum + (t.originalAmount || t.amount), 0);
  }, [filteredTransactions]);

  const filteredAllocatedSum = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === "FUNDING")
      .reduce((sum, t) => sum + t.currentlyAllocated, 0);
  }, [filteredTransactions]);

  const hasActiveFilters =
    searchTerm !== "" ||
    statusFilter !== "all" ||
    dateFilter !== "all" ||
    customStartDate !== "" ||
    customEndDate !== "" ||
    sortBy !== "newest";

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setSortBy("newest");
    setCurrentPage(1);
  };

  const handleViewTx = (tx: LedgerTransactionItem) => {
    setSelectedTx(tx);
    setDetailsOpen(true);
  };

  // Handle Record Received Capital (Advance from Funder)
  const handleSubmitRecordCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordAmount || Number(recordAmount) <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }

    try {
      setIsSubmittingRecord(true);
      const res = await recordReceivedCapitalAction({
        funderId,
        amount: Number(recordAmount),
        fundingDate: recordDate,
        notes: recordNotes.trim() || undefined,
      });

      if (!res.success) {
        toast.error(typeof res.error === "string" ? res.error : "Failed to record received capital.");
        return;
      }

      toast.success(`₹${fmt(Number(recordAmount))} received capital recorded successfully.`);
      setRecordOpen(false);
      setRecordAmount("");
      setRecordNotes("");

      await queryClient.invalidateQueries({ queryKey: ["capital-funder-ledger", funderId] });
      await queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      await refetch();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  // Handle Pay Capital Person (Returning Principal Back to Capital Person)
  const handleSubmitPayCapitalPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }

    if (numAmount > effectivePayable) {
      toast.error(
        `Maximum payable amount is ₹${fmt(effectivePayable)}. Overpayment is not allowed.`
      );
      return;
    }

    try {
      setIsSubmittingPay(true);
      const res = await recordCapitalReturnAction({
        funderId,
        amount: numAmount,
        returnDate: payDate,
        notes: payNotes.trim() || undefined,
      });

      if (!res.success) {
        toast.error(typeof res.error === "string" ? res.error : "Failed to record payment to capital person.");
        return;
      }

      const pCode = res.data?.paymentCode ? ` (${res.data.paymentCode})` : "";
      toast.success(`₹${fmt(numAmount)} paid back to ${funder?.name || "Capital Person"}!${pCode}`);
      setPayPersonOpen(false);
      setPayAmount("");
      setPayNotes("");

      await queryClient.invalidateQueries({ queryKey: ["capital-funder-ledger", funderId] });
      await queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      await refetch();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading Capital Funding Ledger...</p>
      </div>
    );
  }

  if (queryError && !data) {
    if (isDbConnectionError) {
      return (
        <div className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Database Connection Issue</h2>
          <p className="text-xs text-muted-foreground">
            The database connection was interrupted. Your data is safe — please retry.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              className="fx-brand-gradient text-white text-xs font-bold"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Retrying…" : "Retry Connection"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/capital-management")}
              className="text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
            </Button>
          </div>
        </div>
      );
    }
  }

  if (!funder && !isLoading) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Capital Person Not Found</h2>
        <p className="text-xs text-muted-foreground">
          The requested capital person does not exist or has been removed.
        </p>
        <Button
          onClick={() => router.push("/capital-management")}
          className="fx-brand-gradient text-white text-xs font-bold"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Capital Management
        </Button>
      </div>
    );
  }

  if (!funder) return null;

  return (
    <div className="space-y-6 pb-12 w-full max-w-full overflow-x-hidden">
      {/* ── Section 1: Top Navigation & Page Header ────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link
            href="/capital-management"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors py-1 px-2.5 rounded-lg bg-card/60 hover:bg-card border border-border/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Capital Management</span>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/70 border border-border/60 rounded-[22px] p-5 backdrop-blur-md">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                {funder.name} — Capital Funding Ledger
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                On-Demand Capital Provider
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                metrics.status === "CAPITAL SETTLED"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : metrics.status === "PARTIALLY RETURNED"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}>
                <CheckCircle2 className="h-2.5 w-2.5" /> {metrics.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-0.5">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold text-foreground">{funder.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-foreground">{funder.mobile}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Model: <strong className="text-foreground">On-Demand Funding</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 px-3 rounded-xl text-xs font-semibold border-border/60 hover:bg-accent/40"
              title="Refresh Ledger"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Button
              onClick={() => setRecordOpen(true)}
              size="sm"
              variant="outline"
              className="h-9 px-3 rounded-xl text-xs font-bold border-border/60 hover:bg-accent/40"
            >
              <ArrowDownRight className="h-3.5 w-3.5 mr-1 text-emerald-400" />
              <span>Record Advance</span>
            </Button>

            <Button
              onClick={() => {
                setPayAmount(effectivePayable > 0 ? String(effectivePayable) : "");
                setPayDate(new Date().toISOString().split("T")[0]!);
                setPayNotes("");
                setPayPersonOpen(true);
              }}
              disabled={effectivePayable <= 0}
              size="sm"
              className={`h-9 px-4 rounded-xl text-xs font-black shadow-md transition-all ${
                effectivePayable > 0
                  ? "fx-brand-gradient border-0 text-white fx-cta-glow cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-white" />
              <span>{effectivePayable > 0 ? "Pay Capital Person" : "Nothing to Pay"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Section 2: CAPITAL PRINCIPAL SUMMARY (Exact Business Flow) ────────── */}
      <div className="bg-card/70 border border-border/60 rounded-[22px] p-5 space-y-4 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Landmark className="h-4 w-4" /> CAPITAL PRINCIPAL SUMMARY
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                metrics.status === "CAPITAL SETTLED"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : metrics.status === "PARTIALLY RETURNED"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}>
                {metrics.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Principal only — calculated directly from actual borrower payments. No interest or rent.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setPayAmount(effectivePayable > 0 ? String(effectivePayable) : "");
                setPayDate(new Date().toISOString().split("T")[0]!);
                setPayNotes("");
                setPayPersonOpen(true);
              }}
              disabled={effectivePayable <= 0}
              className={`h-9 px-4 rounded-xl text-xs font-black shadow-md ${
                effectivePayable > 0
                  ? "fx-brand-gradient text-white fx-cta-glow hover:scale-[1.02]"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              <span>{effectivePayable > 0 ? "Pay Capital Person" : "Nothing to Pay"}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Original Provided */}
          <div className="p-4 rounded-2xl bg-card/60 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-bold uppercase tracking-wider">Original Provided</span>
              <Coins className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="mt-2">
              <p className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                ₹{fmt(metrics.totalProvided)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total capital funded</p>
            </div>
          </div>

          {/* 2. Currently Allocated */}
          <div className="p-4 rounded-2xl bg-card/60 border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Currently Allocated</span>
              <CreditCard className="h-3.5 w-3.5" />
            </div>
            <div className="mt-2">
              <p className="text-xl md:text-2xl font-black text-emerald-400 tracking-tight">
                ₹{fmt(metrics.currentlyAllocated ?? metrics.totalAllocated)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Active with borrowers</p>
            </div>
          </div>

          {/* 3. Unallocated Capital */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Unallocated</span>
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div className="mt-2">
              <p className="text-xl md:text-2xl font-black text-blue-400 tracking-tight">
                ₹{fmt(metrics.unallocatedReceived)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Available to deploy</p>
            </div>
          </div>

          {/* 4. Returned From Borrower */}
          <div className="p-4 rounded-2xl bg-card/60 border border-blue-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Returned (Borrower)</span>
              <BadgeCheck className="h-3.5 w-3.5" />
            </div>
            <div className="mt-2">
              <p className="text-xl md:text-2xl font-black text-blue-400 tracking-tight">
                ₹{fmt(metrics.returnedFromBorrower)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Borrower principal repaid</p>
            </div>
          </div>

          {/* 5. Paid Back to Capital Person */}
          <div className="p-4 rounded-2xl bg-card/60 border border-purple-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Paid Back to Person</span>
              <RotateCcw className="h-3.5 w-3.5" />
            </div>
            <div className="mt-2">
              <p className="text-xl md:text-2xl font-black text-purple-400 tracking-tight">
                ₹{fmt(metrics.paidBackToCapitalPerson ?? metrics.totalReturned)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Capital returned to funder</p>
            </div>
          </div>

          {/* 6. Payable to Capital Person */}
          <div
            onClick={() => {
              if (effectivePayable > 0) {
                setPayAmount(String(effectivePayable));
                setPayDate(new Date().toISOString().split("T")[0]!);
                setPayNotes("");
                setPayPersonOpen(true);
              }
            }}
            className={`p-4 rounded-2xl bg-primary/10 border border-primary/30 flex flex-col justify-between relative overflow-hidden transition-all ${
              effectivePayable > 0 ? "cursor-pointer hover:border-primary/60 hover:bg-primary/15" : ""
            }`}
          >
            <div className="flex items-center justify-between text-primary">
              <span className="text-[10px] font-bold uppercase tracking-wider">Payable to Person</span>
              {effectivePayable > 0 && (
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <div className="mt-2">
              <div className="flex items-baseline justify-between gap-1">
                <p className="text-xl md:text-2xl font-black text-primary tracking-tight">
                  ₹{fmt(effectivePayable)}
                </p>
                {effectivePayable > 0 && (
                  <span className="text-[10px] font-black text-primary hover:underline">
                    Pay Now →
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {effectivePayable > 0 ? "Ready to pay back now" : "Fully settled with funder"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Navigation Tabs for Financial Events ──────────────────── */}
      <div className="flex items-center gap-1 bg-card/80 p-1.5 rounded-2xl border border-border/50 shadow-inner">
        <button
          onClick={() => setActiveLedgerTab("funding")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeLedgerTab === "funding"
              ? "fx-brand-gradient text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
          }`}
        >
          Capital Funding Events ({rawTransactions.length})
        </button>

        <button
          onClick={() => setActiveLedgerTab("payments_to_funder")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeLedgerTab === "payments_to_funder"
              ? "fx-brand-gradient text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
          }`}
        >
          Payments to Capital Person ({paymentsToCapitalPerson.length})
        </button>

        <button
          onClick={() => setActiveLedgerTab("borrower_repayments")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeLedgerTab === "borrower_repayments"
              ? "fx-brand-gradient text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
          }`}
        >
          Borrower Repayments ({borrowerRepayments.length})
        </button>
      </div>

      {/* ── TAB 1: CAPITAL FUNDING EVENTS (Chinni -> Borrower) ──────────────── */}
      {activeLedgerTab === "funding" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-card/70 border border-border/60 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search borrower, funding ID (CF-001), loan ID..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 h-10 rounded-xl bg-background/70 border-border/50 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 px-3 rounded-xl bg-background/70 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="allocated">Allocated</option>
                  <option value="partially_returned">Partially Returned</option>
                  <option value="returned">Fully Returned</option>
                  <option value="advance">Advance Only</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-10 px-3 rounded-xl bg-background/70 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="amount_desc">Amount (High to Low)</option>
                  <option value="amount_asc">Amount (Low to High)</option>
                  <option value="borrower">Borrower (A-Z)</option>
                </select>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-10 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-card/40 border border-border/50 p-6 space-y-3">
              <Coins className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
              <h3 className="font-bold text-sm text-foreground">No funding transactions found</h3>
              <p className="text-xs text-muted-foreground">
                When you fund a loan with {funder.name}, it will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden md:block rounded-2xl border border-border/60 bg-card/60 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-accent/25 dark:bg-secondary/25">
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-28">Date</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-28">Funding ID</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-24">Type</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-48">Amount & Principal</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px]">Borrower / Loan</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-36">Status</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] text-right w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {paginatedTransactions.map((tx) => (
                      <tr
                        key={tx.transactionId}
                        onClick={() => handleViewTx(tx)}
                        className="hover:bg-accent/20 dark:hover:bg-secondary/20 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                          {formatDate(tx.fundingDate)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                          {tx.transactionCode}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.type === "FUNDING" ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
                              Funding
                            </span>
                          ) : tx.type === "ADVANCE" ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Advance
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              Return
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-extrabold text-foreground text-sm">
                              ₹{fmt(tx.originalAmount || tx.amount)}
                            </span>
                            {tx.type === "FUNDING" && (
                              <div className="text-[10px] space-y-0.5 mt-0.5">
                                <div className="text-emerald-400 font-semibold">
                                  Allocated: ₹{fmt(tx.currentlyAllocated)}
                                </div>
                                <div className="text-blue-400 font-semibold">
                                  Returned: ₹{fmt(tx.returnedFromBorrower)}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {tx.borrowerName ? (
                            <div className="space-y-0.5">
                              <p className="font-bold text-foreground text-xs">
                                {tx.loanId ? tx.borrowerName : `Previously: ${tx.borrowerName}`}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {tx.loanCode || (tx.loanId ? `LN-${tx.loanId.slice(0, 6).toUpperCase()}` : "Loan Deleted")}
                                {tx.loanPrincipal ? ` • ₹${fmt(tx.loanPrincipal)} Principal` : ""}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-blue-400">
                              Unallocated Received Advance
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.type === "FUNDING" && tx.loanId ? (
                            tx.currentlyAllocated === 0 && (tx.originalAmount || tx.amount) > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Fully Returned
                              </span>
                            ) : tx.returnedFromBorrower > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="h-2.5 w-2.5" /> Partially Returned
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Allocated
                              </span>
                            )
                          ) : (tx.status === "received" || tx.status === "unallocated" || tx.type === "UNALLOCATED" || !tx.loanId) ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Clock className="h-2.5 w-2.5" /> Unallocated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted/40 text-muted-foreground border border-border/40">
                              {tx.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewTx(tx)}
                              className="h-7 px-2 text-[11px] font-bold text-foreground hover:bg-accent/40"
                            >
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                            {tx.loanId ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/loan-management?loanId=${tx.loanId}`)}
                                className="h-7 px-2.5 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary/10"
                                title="Open Loan File"
                              >
                                <span>View Loan</span>
                                <ExternalLink className="h-2.5 w-2.5 ml-1" />
                              </Button>
                            ) : tx.borrowerName ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold text-muted-foreground bg-muted/30 border border-border/40">
                                Previously Linked Loan Deleted
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col gap-3">
                {paginatedTransactions.map((tx) => (
                  <div
                    key={tx.transactionId}
                    onClick={() => handleViewTx(tx)}
                    className="w-full rounded-2xl border border-border/60 bg-card/70 p-4 space-y-3 cursor-pointer hover:bg-card transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {formatDate(tx.fundingDate)}
                        </span>
                        <p className="font-mono font-black text-sm text-primary mt-0.5">
                          {tx.transactionCode}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-base text-foreground">
                          ₹{fmt(tx.originalAmount || tx.amount)}
                        </p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {tx.currentlyAllocated === 0 ? "Fully Returned" : tx.status}
                        </span>
                      </div>
                    </div>

                    {tx.type === "FUNDING" && (
                      <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-accent/15 text-[11px] text-center">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Allocated</span>
                          <p className="font-bold text-emerald-400">₹{fmt(tx.currentlyAllocated)}</p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Returned</span>
                          <p className="font-bold text-blue-400">₹{fmt(tx.returnedFromBorrower)}</p>
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 rounded-xl bg-accent/20 dark:bg-secondary/20 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Borrower</span>
                        <strong className="text-foreground">{tx.borrowerName || "Unallocated"}</strong>
                      </div>
                      {tx.loanCode && (
                        <div className="flex justify-between">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Loan</span>
                          <span className="font-mono text-muted-foreground">{tx.loanCode}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1 text-xs text-muted-foreground">
                  <span>
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-8 px-2.5 text-xs font-semibold"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="h-8 px-2.5 text-xs font-semibold"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: PAYMENTS TO CAPITAL PERSON (Section 17: Finexa -> Chinni) ── */}
      {activeLedgerTab === "payments_to_funder" && (
        <div className="bg-card/70 border border-border/60 rounded-[22px] p-5 space-y-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-purple-400" /> PAYMENTS TO CAPITAL PERSON
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record of principal paid back to {funder.name} from borrower repayments.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Total Paid: ₹{fmt(metrics.paidBackToCapitalPerson ?? metrics.totalReturned)}
              </span>
              <Button
                onClick={() => {
                  setPayAmount(effectivePayable > 0 ? String(effectivePayable) : "");
                  setPayDate(new Date().toISOString().split("T")[0]!);
                  setPayNotes("");
                  setPayPersonOpen(true);
                }}
                disabled={effectivePayable <= 0}
                size="sm"
                className={`h-9 px-4 rounded-xl text-xs font-black shadow-md ${
                  effectivePayable > 0
                    ? "fx-brand-gradient text-white fx-cta-glow"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                <span>Pay Capital Person</span>
              </Button>
            </div>
          </div>

          {paymentsToCapitalPerson.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border/30 space-y-2">
              <RotateCcw className="h-6 w-6 mx-auto text-muted-foreground opacity-50" />
              <p className="font-semibold text-foreground text-sm">No payments recorded yet</p>
              <p>When you return capital principal back to {funder.name}, it will be listed here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/40">
              <div className="p-3 bg-accent/10 border-b border-border/30 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Payment History Records ({paymentsToCapitalPerson.length})</span>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Total Paid Back: ₹{fmt(metrics.paidBackToCapitalPerson)}
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-accent/20 border-b border-border/30 text-[10px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 w-32">Date</th>
                    <th className="py-3 px-4 w-36">Payment ID</th>
                    <th className="py-3 px-4 w-48">Type</th>
                    <th className="py-3 px-4 text-right w-36">Amount</th>
                    <th className="py-3 px-4 w-40">Recipient</th>
                    <th className="py-3 px-4">Notes / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {paymentsToCapitalPerson.map((pay) => (
                    <tr key={pay.returnId} className="hover:bg-accent/10">
                      <td className="py-3 px-4 font-medium text-foreground">{formatDate(pay.returnDate)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">{pay.paymentCode}</td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Capital Principal Repayment
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400 text-sm">
                        ₹{fmt(pay.amount)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        To: {funder?.name || "Capital Person"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{pay.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: BORROWER REPAYMENTS (Section 7: Borrower -> Finexa) ───────── */}
      {activeLedgerTab === "borrower_repayments" && (
        <div className="bg-card/70 border border-border/60 rounded-[22px] p-5 space-y-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-blue-400" /> BORROWER PRINCIPAL REPAYMENTS
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Actual principal repayments collected from borrowers for loans funded by {funder.name}.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Total Returned: ₹{fmt(metrics.returnedFromBorrower)}
            </span>
          </div>

          {borrowerRepayments.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border/30 space-y-2">
              <BadgeCheck className="h-6 w-6 mx-auto text-muted-foreground opacity-50" />
              <p className="font-semibold text-foreground text-sm">No borrower principal repayments yet</p>
              <p>When borrowers pay principal on loans funded by {funder.name}, payments will appear here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-accent/20 border-b border-border/30 text-[10px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 w-32">Payment Date</th>
                    <th className="py-3 px-4 w-32">Loan Code</th>
                    <th className="py-3 px-4">Borrower Name</th>
                    <th className="py-3 px-4 text-right w-36">Principal Amount</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {borrowerRepayments.map((p) => (
                    <tr key={p.paymentId} className="hover:bg-accent/10">
                      <td className="py-3 px-4 font-medium text-foreground">{formatDate(p.paymentDate)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">{p.loanCode}</td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {p.borrowerName} <span className="text-[10px] text-muted-foreground font-mono">({p.borrowerMobile})</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-blue-400 text-sm">
                        ₹{fmt(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{p.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Section 4: Modal — Transaction Details ──────────────────────────── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl p-6 bg-card border border-border/70 shadow-2xl">
          {selectedTx && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase bg-primary/10 text-primary border border-primary/20">
                    {selectedTx.transactionCode}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {selectedTx.currentlyAllocated === 0 ? "Fully Returned" : selectedTx.status}
                  </span>
                </div>
                <DialogTitle className="text-lg font-black text-foreground pt-1">
                  Funding Transaction Details
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Individual on-demand capital deployment record
                </DialogDescription>
              </DialogHeader>

              <div className="p-4 rounded-xl bg-accent/25 dark:bg-secondary/25 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Original Funding Amount</span>
                <p className="text-2xl font-black text-primary">₹{fmt(selectedTx.originalAmount || selectedTx.amount)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(selectedTx.fundingDate)}</p>
              </div>

              {selectedTx.type === "FUNDING" && selectedTx.loanId ? (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-accent/15 text-center text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Currently Allocated</span>
                    <p className="font-extrabold text-emerald-400 text-base mt-0.5">₹{fmt(selectedTx.currentlyAllocated)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Returned by Borrower</span>
                    <p className="font-extrabold text-blue-400 text-base mt-0.5">₹{fmt(selectedTx.returnedFromBorrower)}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center text-xs space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-blue-400">Available Unallocated Capital</span>
                  <p className="font-extrabold text-blue-400 text-lg">₹{fmt(selectedTx.originalAmount || selectedTx.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">Available to allocate to future loans</p>
                </div>
              )}

              <div className="divide-y divide-border/30 border border-border/30 rounded-xl overflow-hidden text-xs">
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Capital Person:</span>
                  <span className="font-bold text-foreground">{funder.name} ({funder.mobile})</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Transaction Type:</span>
                  <span className="font-bold text-foreground">
                    {selectedTx.type}
                  </span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Current Status:</span>
                  <span className="font-bold uppercase text-blue-400">
                    {selectedTx.status}
                  </span>
                </div>

                {selectedTx.borrowerName && (
                  <>
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">
                        {selectedTx.loanId ? "Borrower Name:" : "Previously Allocated To:"}
                      </span>
                      <span className="font-bold text-foreground">{selectedTx.borrowerName}</span>
                    </div>
                    {selectedTx.borrowerMobile && (
                      <div className="p-3 flex justify-between">
                        <span className="text-muted-foreground">Borrower Mobile:</span>
                        <span className="font-mono text-foreground">{selectedTx.borrowerMobile}</span>
                      </div>
                    )}
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Loan Reference:</span>
                      <span className="font-mono font-bold text-primary">
                        {selectedTx.loanCode || (selectedTx.loanId ? `LN-${selectedTx.loanId.slice(0, 6).toUpperCase()}` : "Loan Deleted")}
                      </span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Loan Status:</span>
                      <span className={`font-bold ${selectedTx.loanId ? "text-emerald-400" : "text-amber-400"}`}>
                        {selectedTx.loanId ? (selectedTx.loanStatus || "Active") : "Deleted"}
                      </span>
                    </div>
                    {selectedTx.loanPrincipal && (
                      <div className="p-3 flex justify-between">
                        <span className="text-muted-foreground">Loan Principal:</span>
                        <span className="font-bold text-foreground">₹{fmt(selectedTx.loanPrincipal)}</span>
                      </div>
                    )}
                  </>
                )}

                {selectedTx.notes && (
                  <div className="p-3 space-y-1">
                    <span className="text-muted-foreground block">Notes & Remarks:</span>
                    <p className="text-xs text-foreground bg-background/50 p-2 rounded-lg font-normal">
                      {selectedTx.notes}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
                {selectedTx.loanId ? (
                  <Button
                    onClick={() => {
                      setDetailsOpen(false);
                      router.push(`/loan-management?loanId=${selectedTx.loanId}`);
                    }}
                    className="w-full sm:flex-1 fx-brand-gradient text-white text-xs font-bold"
                  >
                    <span>View Loan</span>
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                ) : selectedTx.borrowerName ? (
                  <div className="w-full sm:flex-1 p-2 rounded-lg bg-muted/40 border border-border/40 text-center text-[11px] font-semibold text-muted-foreground">
                    Previously Linked Loan Deleted
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => setDetailsOpen(false)}
                  className="w-full sm:w-auto text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Section 5: Modal — Record Received Advance ───────────────────────── */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl p-6 bg-card border border-border/70 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-emerald-400" /> Record Received Advance
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record capital received in advance from {funder.name} pending loan allocation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRecordCapital} className="space-y-4 pt-2">
            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Capital Person
              </label>
              <Input
                value={`${funder.name} (${funder.mobile})`}
                disabled
                className="bg-muted/40 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Amount Received (₹) *
              </label>
              <Input
                type="number"
                placeholder="e.g. 10000"
                value={recordAmount}
                onChange={(e) => setRecordAmount(e.target.value)}
                required
                min="1"
                step="any"
                className="h-11 text-base font-bold tracking-tight rounded-xl"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Received Date *
              </label>
              <Input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                required
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Notes / Reference
              </label>
              <Input
                placeholder="e.g. Advance transfer"
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRecordOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingRecord}
                className="fx-brand-gradient text-white text-xs font-bold"
              >
                {isSubmittingRecord ? "Recording..." : "Record Advance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Section 6: Modal — Pay Capital Person (Returning Principal) ───────── */}
      <Dialog open={payPersonOpen} onOpenChange={setPayPersonOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl p-6 bg-card border border-border/70 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" /> Pay Capital Person
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Return capital principal to {funder.name}. Principal only — no interest.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitPayCapitalPerson} className="space-y-4 pt-2">
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Maximum Principal Available to Pay
              </span>
              <p className="text-2xl font-black text-primary">₹{fmt(effectivePayable)}</p>
              <p className="text-[10px] text-muted-foreground">
                Principal only. No interest, rent, or profit. Overpayment is prevented.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Capital Person
              </label>
              <Input
                value={`${funder.name} (${funder.mobile})`}
                disabled
                className="bg-muted/40 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Payment Amount (₹) *
              </label>
              <Input
                type="number"
                placeholder={`Max: ${effectivePayable}`}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                min="1"
                max={effectivePayable}
                step="any"
                className="h-11 text-base font-bold tracking-tight rounded-xl"
              />
              {Number(payAmount) > effectivePayable && (
                <p className="text-[11px] text-destructive font-semibold mt-1">
                  Maximum payable amount is ₹{fmt(effectivePayable)}.
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Payment Date *
              </label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                required
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Notes (Optional)
              </label>
              <Input
                placeholder="e.g. Principal repaid from borrower payments"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayPersonOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmittingPay ||
                  Number(payAmount) <= 0 ||
                  Number(payAmount) > effectivePayable
                }
                className="fx-brand-gradient text-white text-xs font-bold"
              >
                {isSubmittingPay ? "Processing..." : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
