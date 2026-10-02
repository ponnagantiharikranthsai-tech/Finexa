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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  FileText,
  RotateCcw,
  Receipt,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Landmark,
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

  // Query funder ledger with retry on connection errors
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
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000), // exponential: 2s, 4s, 8s
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

  // Dialog state: Transaction Details
  const [selectedTx, setSelectedTx] = useState<LedgerTransactionItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Dialog state: Record Capital Received
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordAmount, setRecordAmount] = useState("");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]!);
  const [recordNotes, setRecordNotes] = useState("");
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);

  const funder = data?.funder;
  const metrics = data?.metrics || {
    totalProvided: 0,
    totalAllocated: 0,
    unallocatedReceived: 0,
    totalReturned: 0,
    transactionCount: 0,
  };
  const rawTransactions = data?.transactions || [];

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
      } else if (dateFilter === "this_week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        list = list.filter((tx) => new Date(tx.fundingDate) >= weekAgo);
      } else if (dateFilter === "this_month") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        list = list.filter((tx) => new Date(tx.fundingDate) >= startOfMonth);
      } else if (dateFilter === "custom") {
        if (customStartDate) {
          list = list.filter((tx) => tx.fundingDate >= customStartDate);
        }
        if (customEndDate) {
          list = list.filter((tx) => tx.fundingDate <= customEndDate);
        }
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
        return b.amount - a.amount;
      }
      if (sortBy === "amount_asc") {
        return a.amount - b.amount;
      }
      if (sortBy === "borrower") {
        const nameA = a.borrowerName || "zzz";
        const nameB = b.borrowerName || "zzz";
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
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const filteredAllocatedSum = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.status === "allocated")
      .reduce((sum, t) => sum + t.amount, 0);
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

  // Handle open transaction details
  const handleViewTx = (tx: LedgerTransactionItem) => {
    setSelectedTx(tx);
    setDetailsOpen(true);
  };

  // Handle Record Received Capital
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

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["capital-funder-ledger", funderId] });
      await queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      await refetch();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmittingRecord(false);
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
      // DB connection failure — show retry, not "not found"
      return (
        <div className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Database Connection Issue</h2>
          <p className="text-xs text-muted-foreground">
            The local database connection was interrupted (ECONNRESET). This is a temporary glitch
            with the local PostgreSQL server. Your data is safe — please retry.
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

  // TypeScript narrowing guard — funder is always defined past this point
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
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" /> {funder.status}
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
              className="h-9 px-4 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-cta-glow shadow-md"
            >
              <ArrowDownRight className="h-3.5 w-3.5 mr-1.5 text-emerald-300" />
              <span>Record Received Capital</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Summary Metric Cards (Calculated from Actuals) ────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Provided */}
        <div className="p-4 rounded-2xl bg-card/60 border border-border/60 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Provided</span>
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Coins className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground tracking-tight">
              ₹{fmt(metrics.totalProvided)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Sum of actual funding transactions
            </p>
          </div>
        </div>

        {/* Card 2: Currently Allocated */}
        <div className="p-4 rounded-2xl bg-card/60 border border-border/60 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Allocated</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-400 tracking-tight">
              ₹{fmt(metrics.totalAllocated)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Deployed into active borrower loans
            </p>
          </div>
        </div>

        {/* Card 3: Unallocated Received */}
        <div className="p-4 rounded-2xl bg-card/60 border border-border/60 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unallocated Received</span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-400 tracking-tight">
              ₹{fmt(metrics.unallocatedReceived)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Received advance ready to be deployed
            </p>
          </div>
        </div>

        {/* Card 4: Total Transactions */}
        <div className="p-4 rounded-2xl bg-card/60 border border-border/60 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Funding Events</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground tracking-tight">
              {metrics.transactionCount}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Individual on-demand funding events
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 3: Toolbar (Search, Filter, Date Range, Sort) ───────────── */}
      <div className="bg-card/70 border border-border/60 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search box */}
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

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 rounded-xl bg-background/70 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="allocated">Allocated (Loans)</option>
              <option value="advance">Advance (Unallocated)</option>
              <option value="released">Released / Repaid</option>
            </select>

            {/* Date Preset Filter */}
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 rounded-xl bg-background/70 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this_week">Past 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>

            {/* Sort Dropdown */}
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

        {/* Custom Date Range Inputs (if selected) */}
        {dateFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/30">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>From:</span>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-36 text-xs bg-background/80 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>To:</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-36 text-xs bg-background/80 rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Ledger Title & Subtitle ──────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
            <Landmark className="h-4 w-4" /> CAPITAL FUNDING LEDGER
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete chronological record of capital funding transactions and their linked loans.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredTransactions.length}</strong> record{filteredTransactions.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Section 5: The Ledger (Desktop Financial Table + Mobile Cards) ──── */}
      {filteredTransactions.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-card/40 border border-border/50 p-6 space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center mx-auto">
            <Coins className="h-6 w-6 opacity-60" />
          </div>
          <h3 className="font-bold text-sm text-foreground">No funding transactions found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {hasActiveFilters
              ? "No transactions match your current search or date filters."
              : `${funder.name} uses the On-Demand funding model. When you fund a loan with ${funder.name}, it will appear here automatically.`}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            {hasActiveFilters ? (
              <Button size="sm" variant="outline" onClick={handleResetFilters} className="text-xs">
                Clear Filters
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setRecordOpen(true)}
                className="fx-brand-gradient text-white text-xs font-bold"
              >
                <ArrowDownRight className="h-3.5 w-3.5 mr-1" /> Record Received Capital
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* DESKTOP TABLE (Hidden on small screens, perfectly responsive without clipping) */}
          <div className="hidden md:block rounded-2xl border border-border/60 bg-card/60 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-accent/25 dark:bg-secondary/25">
                  <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-28">Date</th>
                  <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-28">Funding ID</th>
                  <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-24">Type</th>
                  <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-32">Amount</th>
                  <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px]">Borrower / Loan</th>
                  <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] w-28">Status</th>
                  <th className="py-3 px-4 font-bold text-muted-foreground uppercase text-[10px] text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {paginatedTransactions.map((tx) => (
                  <tr
                    key={tx.transactionId}
                    onClick={() => handleViewTx(tx)}
                    className="hover:bg-accent/20 dark:hover:bg-secondary/20 transition-colors cursor-pointer"
                  >
                    {/* Date */}
                    <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                      {formatDate(tx.fundingDate)}
                    </td>

                    {/* Funding ID */}
                    <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                      {tx.transactionCode}
                    </td>

                    {/* Type */}
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
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Return
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 font-black text-sm text-foreground whitespace-nowrap">
                      ₹{fmt(tx.amount)}
                    </td>

                    {/* Borrower / Loan */}
                    <td className="py-3 px-4">
                      {tx.borrowerName ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground text-xs">{tx.borrowerName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {tx.loanCode || (tx.loanId ? `LN-${tx.loanId.slice(0, 6).toUpperCase()}` : "—")}
                            {tx.loanPrincipal ? ` • ₹${fmt(tx.loanPrincipal)} Principal` : ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-blue-400">
                          Unallocated Received Advance
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.status === "allocated" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Allocated
                        </span>
                      ) : tx.status === "received" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Clock className="h-2.5 w-2.5" /> Unallocated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted/40 text-muted-foreground border border-border/40">
                          {tx.status}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
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

                        {tx.loanId && (
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
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS (Visible only on < md screens, zero horizontal overflow) */}
          <div className="md:hidden flex flex-col gap-3">
            {paginatedTransactions.map((tx) => (
              <div
                key={tx.transactionId}
                onClick={() => handleViewTx(tx)}
                className="w-full rounded-2xl border border-border/60 bg-card/70 p-4 space-y-3 cursor-pointer hover:bg-card transition-colors shadow-sm"
              >
                {/* Header row */}
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
                      ₹{fmt(tx.amount)}
                    </p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {tx.status}
                    </span>
                  </div>
                </div>

                {/* Borrower / Allocation Info */}
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

                {/* Mobile Action Buttons */}
                <div className="flex items-center justify-between pt-1 gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewTx(tx)}
                    className="h-8 px-3 text-xs font-semibold text-foreground flex-1"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> View Details
                  </Button>

                  {tx.loanId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/loan-management?loanId=${tx.loanId}`)}
                      className="h-8 px-3 text-xs font-bold text-primary border-primary/30 flex-1"
                    >
                      <span>View Loan</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Section 6: Pagination & Summary Status Bar ─────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 px-1 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Showing <strong>{(safeCurrentPage - 1) * pageSize + 1}</strong>–
                <strong>{Math.min(safeCurrentPage * pageSize, filteredTransactions.length)}</strong> of{" "}
                <strong>{filteredTransactions.length}</strong> transactions
              </span>

              <span className="hidden sm:inline">•</span>

              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 px-2 rounded-lg bg-card border border-border/40 text-xs font-semibold text-foreground"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 self-center sm:self-auto">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 text-xs font-semibold"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>

                <span className="px-2 font-mono text-xs">
                  {safeCurrentPage} / {totalPages}
                </span>

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
            )}
          </div>

          {/* Bottom Totals Bar */}
          <div className="p-3.5 rounded-xl bg-accent/15 dark:bg-secondary/15 border border-border/40 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Landmark className="h-4 w-4 text-primary" />
              <span>Ledger Summary (Current View)</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-muted-foreground mr-1">Filtered Sum:</span>
                <strong className="text-foreground">₹{fmt(filteredProvidedSum)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground mr-1">Allocated:</span>
                <strong className="text-emerald-400">₹{fmt(filteredAllocatedSum)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground mr-1">Unallocated:</span>
                <strong className="text-blue-400">
                  ₹{fmt(Math.max(0, filteredProvidedSum - filteredAllocatedSum))}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 7: Modal — Transaction Details ──────────────────────────── */}
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
                    {selectedTx.status}
                  </span>
                </div>
                <DialogTitle className="text-lg font-black text-foreground pt-1">
                  Funding Transaction Details
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Individual on-demand capital deployment record
                </DialogDescription>
              </DialogHeader>

              {/* Amount & Date Card */}
              <div className="p-4 rounded-xl bg-accent/25 dark:bg-secondary/25 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Funding Amount</span>
                <p className="text-2xl font-black text-primary">₹{fmt(selectedTx.amount)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(selectedTx.fundingDate)}</p>
              </div>

              {/* Transaction Key Details */}
              <div className="divide-y divide-border/30 border border-border/30 rounded-xl overflow-hidden text-xs">
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Capital Person:</span>
                  <span className="font-bold text-foreground">{funder.name} ({funder.mobile})</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Transaction Type:</span>
                  <span className="font-bold text-foreground">{selectedTx.type}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-bold text-emerald-400 capitalize">{selectedTx.status}</span>
                </div>

                {selectedTx.borrowerName && (
                  <>
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Borrower Name:</span>
                      <span className="font-bold text-foreground">{selectedTx.borrowerName}</span>
                    </div>
                    {selectedTx.borrowerMobile && (
                      <div className="p-3 flex justify-between">
                        <span className="text-muted-foreground">Borrower Mobile:</span>
                        <span className="font-mono text-foreground">{selectedTx.borrowerMobile}</span>
                      </div>
                    )}
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Linked Loan:</span>
                      <span className="font-mono font-bold text-primary">
                        {selectedTx.loanCode || selectedTx.loanId?.slice(0, 8)}
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

                {/* Receipt Status */}
                <div className="p-3 flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5" /> Receipt:
                  </span>
                  {selectedTx.hasReceipt ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Receipt Available
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">No receipt attached</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
                {selectedTx.loanId && (
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
                )}
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

      {/* ── Section 8: Modal — Record Received Capital ──────────────────────── */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl p-6 bg-card border border-border/70 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-emerald-400" /> Record Received Capital
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record capital received in advance from {funder.name}.
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
                Notes / Purpose / Reference
              </label>
              <Input
                placeholder="e.g. Received for Jagadeesh loan or advance transfer"
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
                {isSubmittingRecord ? "Recording..." : "Record Capital"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
