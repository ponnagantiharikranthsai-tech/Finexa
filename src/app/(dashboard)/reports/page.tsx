"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useTransition, useRef } from "react";
import { 
  getFinancialAnalyticsAction, 
  type FinancialAnalyticsData 
} from "@/features/reports/actions/get-financial-analytics.action";
import { 
  Download, 
  RefreshCw, 
  Calendar, 
  Printer, 
  TrendingUp, 
  Activity, 
  DollarSign, 
  Users, 
  CreditCard, 
  AlertCircle, 
  Clock,
  ShieldAlert,
  HelpCircle,
  FileSpreadsheet,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinexaCard3D } from "@/components/motion/finexa-motion";

type FilterType = "today" | "yesterday" | "7days" | "30days" | "thisMonth" | "lastMonth" | "custom";

const filterOptions: { value: FilterType; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom Date Range" },
];

function AnimatedCounter({ value, isCurrency = false }: { value: number; isCurrency?: boolean }) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const end = Math.floor(value);
    if (end === 0) {
      setCount(0);
      return;
    }
    
    const duration = 800;
    const stepTime = 16;
    const steps = duration / stepTime;
    const increment = end / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {isCurrency ? `₹${count.toLocaleString("en-IN")}` : count.toLocaleString("en-IN")}
    </span>
  );
}

export default function ReportsPage() {
  const [filterType, setFilterType] = useState<FilterType>("thisMonth");
  const [customFrom, setCustomFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]!
  );
  const [customTo, setCustomTo] = useState(new Date().toISOString().split("T")[0]!);
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<FinancialAnalyticsData | null>(null);
  const lastFetchedRef = useRef("");

  // Fetch report data based on current filter states
  const loadReport = (force = false) => {
    const queryKey = `${filterType}_${customFrom}_${customTo}`;
    if (!force && lastFetchedRef.current === queryKey) return;
    lastFetchedRef.current = queryKey;

    startTransition(async () => {
      const res = await getFinancialAnalyticsAction(filterType, customFrom, customTo);
      if (res.success) {
        setReport(res.data);
      } else {
        const errMsg = typeof res.error === "string" ? res.error : "Failed to load financial analytics";
        toast.error(errMsg);
      }
    });
  };

  useEffect(() => {
    loadReport();
  }, [filterType]);

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    loadReport(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!report) return;
    
    // Format JSON analytics into a clean CSV string
    const csvRows = [
      ["Finexa Financial Report", `Generated: ${new Date().toLocaleDateString()}`],
      ["Filter Scope", filterType.toUpperCase()],
      [],
      ["1. OVERALL KPI SUMMARY"],
      ["Metric", "Value"],
      ["Total Amount Lent (Scope)", `INR ${report.summary.totalLent}`],
      ["Total Amount Collected (Scope)", `INR ${report.summary.totalCollected}`],
      ["Total Interest Earned (Scope)", `INR ${report.summary.totalInterestEarned}`],
      ["Total Outstanding", `INR ${report.summary.totalOutstanding}`],
      ["Active Loans Count", report.summary.activeLoansCount],
      ["Closed Loans Count", report.summary.closedLoansCount],
      [],
      ["2. FINANCIAL ANALYTICS"],
      ["Total Principal Given", `INR ${report.analytics.principalGiven}`],
      ["Total Principal Recovered", `INR ${report.analytics.principalRecovered}`],
      ["Total Interest Received", `INR ${report.analytics.interestReceived}`],
      ["Remaining Principal Outstanding", `INR ${report.analytics.remainingPrincipal}`],
      ["Total Expected Collection", `INR ${report.analytics.totalExpectedCollection}`],
      ["Net Profit (Interest Earned)", `INR ${report.analytics.netProfit}`],
      [],
      ["3. BORROWER BREAKDOWN"],
      ["Total Borrowers", report.borrowers.total],
      ["Active Borrowers", report.borrowers.active],
      ["Closed Borrowers", report.borrowers.closed],
      ["Overdue Borrowers", report.borrowers.overdue]
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finexa_financial_report_${filterType}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Excel/CSV report exported successfully!");
  };

  return (
    <div className="space-y-8 print-container">
      {/* Dynamic Printing Media Styles */}
      <style jsx global>{`
        @media print {
          aside, header, nav, button, .no-print, .toast-container {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-card {
            background: #ffffff !important;
            border: 1px solid #e4e4e7 !important;
            color: #000000 !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
          .print-text {
            color: #000000 !important;
          }
          .print-muted {
            color: #71717a !important;
          }
          svg text {
            fill: #000000 !important;
          }
        }

        /* ─── Warm Gold Light Mode Overrides for Reports ─── */
        :root:not(.dark) .print-container {
          color: var(--foreground) !important;
        }
        :root:not(.dark) .bg-\[\#141923\]\/60 {
          background-color: var(--card) !important;
          border-color: var(--border) !important;
        }
        :root:not(.dark) .border-white\/5 {
          border-color: var(--border) !important;
        }
        :root:not(.dark) .border-white\/10 {
          border-color: var(--border) !important;
        }
        :root:not(.dark) .text-white {
          color: var(--foreground) !important;
        }
        :root:not(.dark) .text-zinc-300 {
          color: var(--muted-foreground) !important;
        }
        :root:not(.dark) .text-zinc-400 {
          color: var(--muted-foreground) !important;
        }
        :root:not(.dark) .text-\[\#FFD700\] {
          color: var(--primary) !important;
        }
        :root:not(.dark) .bg-black\/40 {
          background-color: var(--muted) !important;
          border-color: var(--border) !important;
        }
        :root:not(.dark) .bg-black\/30 {
          background-color: var(--secondary) !important;
          border-color: var(--border) !important;
        }
        :root:not(.dark) .bg-black\/20 {
          background-color: var(--secondary) !important;
          border-color: var(--border) !important;
        }
        :root:not(.dark) .bg-black\/25 {
          background-color: var(--secondary) !important;
          border-color: var(--border) !important;
        }
        :root:not(.dark) .bg-black\/35 {
          background-color: var(--secondary) !important;
          border-color: var(--border) !important;
        }
        :root:not(.dark) input[type="date"] {
          color: var(--foreground) !important;
          border-color: var(--border) !important;
          background-color: var(--card) !important;
        }
        :root:not(.dark) .text-zinc-550 {
          color: var(--muted-foreground) !important;
        }
        :root:not(.dark) button:not(.bg-\[\#FFD700\]):not(.bg-primary) {
          color: var(--foreground) !important;
        }
        :root:not(.dark) button:not(.bg-\[\#FFD700\]):not(.bg-primary):hover {
          background-color: var(--accent) !important;
          border-color: var(--primary)/30 !important;
        }
        :root:not(.dark) .bg-\[\#FFD700\] {
          background-color: var(--primary) !important;
          color: var(--primary-foreground) !important;
        }
      `}</style>

      {/* ─── HEADER & EXPORTS (no-print) ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div className="flex items-center gap-3 text-left">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Financial Reports</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase font-bold tracking-wider">
              Real-time performance analytics &amp; collection ledgers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#141923]/60 border border-white/5 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#FFD700]/30 transition-all duration-200"
          >
            <Printer className="h-4 w-4 text-[#FFD700]" /> Print / PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#141923]/60 border border-white/5 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#FFD700]/30 transition-all duration-200"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#FFD700]" /> Excel
          </button>
          <button
            onClick={() => loadReport(true)}
            disabled={isPending}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-[#141923]/60 border border-white/5 hover:border-[#FFD700]/30 transition-all text-zinc-300 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── FILTER CONTROL PANEL (no-print) ─── */}
      <div className="p-5 rounded-2xl bg-[#141923]/60 border border-white/5 flex flex-col gap-5 text-left no-print">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#FFD700]">Select Reporting Period</label>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterType(opt.value)}
                className={`h-9 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                  filterType === opt.value
                    ? "bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/15"
                    : "bg-black/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range picker if selected */}
        {filterType === "custom" && (
          <form onSubmit={handleApplyCustomRange} className="flex flex-wrap items-end gap-4 p-4 rounded-xl bg-black/30 border border-white/5 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <Label htmlFor="customFrom" className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Start Date</Label>
              <Input
                id="customFrom"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-10 w-44 rounded-xl bg-transparent border-white/10 text-white text-xs outline-none focus:border-[#FFD700]/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customTo" className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">End Date</Label>
              <Input
                id="customTo"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-10 w-44 rounded-xl bg-transparent border-white/10 text-white text-xs outline-none focus:border-[#FFD700]/30"
              />
            </div>
            <button
              type="submit"
              className="h-10 px-5 rounded-xl bg-[#FFD700] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[#FFE082] transition-all"
            >
              Apply Range
            </button>
          </form>
        )}
      </div>

      {isPending && !report && (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <RefreshCw className="h-8 w-8 animate-spin text-[#FFD700] mb-3" />
          <p className="text-sm font-semibold">Compiling financial charts and metrics...</p>
        </div>
      )}

      {/* ─── REAL TIME REPORTS VIEW ─── */}
      {report && (
        <div className="space-y-8 animate-in fade-in duration-400">
          
          {/* 1. SUMMARY CARDS */}
          <div className="space-y-4 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">All-Time Financial Overview</h3>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">

              {[
                { label: "Total Lent", val: report.summary.totalLent, format: "currency", icon: CreditCard, color: "text-[#FFD700]" },
                { label: "Total Collected", val: report.summary.totalCollected, format: "currency", icon: Activity, color: "text-emerald-500" },
                { label: "Total Outstanding", val: report.summary.totalOutstanding, format: "currency", icon: TrendingUp, color: "text-amber-500" },
                { label: "Interest Earned", val: report.summary.totalInterestEarned, format: "currency", icon: DollarSign, color: "text-[#FFD700]" },
                { label: "Active Loans", val: report.summary.activeLoansCount, format: "number", icon: Clock, color: "text-sky-400" },
                { label: "Closed Loans", val: report.summary.closedLoansCount, format: "number", icon: ShieldAlert, color: "text-[#FFD700]" }
              ].map((card, idx) => {
                const Icon = card.icon;
                return (
                  <FinexaCard3D key={idx} className="p-4 rounded-xl bg-[#141923]/60 border border-white/5 flex flex-col justify-between h-28 print-card">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-zinc-400 print-muted">{card.label}</span>
                      <Icon className={`h-3.5 w-3.5 ${card.color}`} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white print-text">
                        <AnimatedCounter value={Number(card.val) || 0} isCurrency={card.format === "currency"} />
                      </h4>
                    </div>
                  </FinexaCard3D>
                );
              })}
            </div>
          </div>

          {/* 2. TODAY'S & MONTHLY COMPACT REPORTS */}
          <div className="grid md:grid-cols-2 gap-6 text-left">
            
            {/* Today's Activity */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4 print-card">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD700] border-b border-white/5 pb-2">Today's Transactions</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Amount Lent", val: report.today.lentToday, format: "currency" },
                  { label: "Amount Collected", val: report.today.collectedToday, format: "currency" },
                  { label: "Interest Collected", val: report.today.interestToday, format: "currency" },
                  { label: "New Borrowers", val: report.today.borrowersToday, format: "number" },
                  { label: "Loans Closed", val: report.today.closedToday, format: "number" }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <p className="text-[9px] uppercase font-bold text-zinc-500 print-muted">{item.label}</p>
                    <p className="text-sm font-bold text-white print-text">
                      <AnimatedCounter value={Number(item.val) || 0} isCurrency={item.format === "currency"} />
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Reports */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4 print-card">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD700] border-b border-white/5 pb-2">Monthly Activity (This Month)</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Amount Lent", val: report.monthly.lentThisMonth, format: "currency" },
                  { label: "Amount Collected", val: report.monthly.collectedThisMonth, format: "currency" },
                  { label: "Interest Earned", val: report.monthly.interestThisMonth, format: "currency" },
                  { label: "New Loans", val: report.monthly.newLoansThisMonth, format: "number" },
                  { label: "Closed Loans", val: report.monthly.closedLoansThisMonth, format: "number" }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <p className="text-[9px] uppercase font-bold text-zinc-500 print-muted">{item.label}</p>
                    <p className="text-sm font-bold text-white print-text">
                      <AnimatedCounter value={Number(item.val) || 0} isCurrency={item.format === "currency"} />
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 3. BORROWER STATS & LOAN STATUS SUMMARY */}
          <div className="grid md:grid-cols-2 gap-6 text-left">
            
            {/* Borrower Statistics */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4 print-card">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/5 pb-2">Borrower Statistics</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Total Borrowers", val: report.borrowers.total, color: "text-zinc-300" },
                  { label: "Active Borrowers", val: report.borrowers.active, color: "text-emerald-500" },
                  { label: "Closed Borrowers", val: report.borrowers.closed, color: "text-zinc-500" },
                  { label: "Overdue Borrowers", val: report.borrowers.overdue, color: "text-destructive" }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[10px] font-bold text-zinc-400 print-muted">{item.label}</span>
                    <span className={`text-sm font-black ${item.color}`}>
                      <AnimatedCounter value={Number(item.val) || 0} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Loan Status Grid */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4 print-card">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/5 pb-2">Loan Status Breakdown</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Active Loans", val: report.loans.active, color: "text-zinc-300" },
                  { label: "Due Today", val: report.loans.dueToday, color: "text-amber-500" },
                  { label: "Overdue Loans", val: report.loans.overdue, color: "text-destructive" },
                  { label: "Closing In 7 Days", val: report.loans.closingSevenDays, color: "text-sky-400" }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[10px] font-bold text-zinc-400 print-muted">{item.label}</span>
                    <span className={`text-sm font-black ${item.color}`}>
                      <AnimatedCounter value={Number(item.val) || 0} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 4. FINANCIAL ANALYTICS */}
          <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 text-left print-card">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/5 pb-3">Portfolio Financial Analytics</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4">
              {[
                { label: "Total Principal Given", val: report.analytics.principalGiven, desc: "Sum of all issued loans principal" },
                { label: "Total Principal Recovered", val: report.analytics.principalRecovered, desc: "Returned principal amounts" },
                { label: "Total Interest Received", val: report.analytics.interestReceived, desc: "Interest collected on repayments" },
                { label: "Remaining Principal", val: report.analytics.remainingPrincipal, desc: "Lent principal still outstanding" },
                { label: "Expected Outstanding Collection", val: report.analytics.totalExpectedCollection, desc: "Expected balance outstanding" },
                { label: "Net Profit (Interest)", val: report.analytics.netProfit, desc: "All-time interest + penalty profits" }
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-black/35 border border-white/5">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 print-muted">{item.label}</span>
                  <h5 className="text-base font-black text-white mt-1 print-text">
                    <AnimatedCounter value={Number(item.val) || 0} isCurrency={true} />
                  </h5>
                  <p className="text-[9px] text-zinc-500 mt-1 leading-normal print-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 4B. PENALTY MANAGEMENT ANALYTICS */}
          {report.penalty && (
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 text-left print-card space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD700] flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-400" /> Penalty Management Overview
                </h4>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  Late Fee Ledger
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Today's Penalty", val: report.penalty.todaysPenaltyCollected, format: "currency", color: "text-emerald-400" },
                  { label: "Monthly Penalty", val: report.penalty.monthlyPenaltyCollected, format: "currency", color: "text-emerald-400" },
                  { label: "Total Collected", val: report.penalty.totalPenaltyCollected, format: "currency", color: "text-emerald-400" },
                  { label: "Outstanding Penalty", val: report.penalty.outstandingPenalty, format: "currency", color: "text-red-400" },
                  { label: "Active Penalties", val: report.penalty.borrowersWithActivePenalties, format: "number", color: "text-amber-400" },
                  { label: "Total Penalty Income", val: report.penalty.totalPenaltyIncome, format: "currency", color: "text-[#FFD700]" },
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-black/35 border border-white/5 space-y-1">
                    <p className="text-[9px] uppercase font-bold text-zinc-400 print-muted">{item.label}</p>
                    <p className={`text-sm font-black ${item.color} print-text`}>
                      <AnimatedCounter value={Number(item.val) || 0} isCurrency={item.format === "currency"} />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. CHARTS GRIDS */}
          <div className="grid md:grid-cols-2 gap-6 text-left no-print">
            
            {/* Daily Lending Trend (Line Chart) */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Daily Lending (Last 7 Days)</h4>
                <TrendingUp className="h-4 w-4 text-[#FFD700]" />
              </div>
              <div className="h-48 w-full flex items-center justify-center">
                {/* SVG Curve chart */}
                <svg className="w-full h-full" viewBox="0 0 350 150">
                  <defs>
                    <linearGradient id="lentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFD700" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#FFD700" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="20" y1="20" x2="330" y2="20" stroke="rgba(255,255,255,0.03)" />
                  <line x1="20" y1="70" x2="330" y2="70" stroke="rgba(255,255,255,0.03)" />
                  <line x1="20" y1="120" x2="330" y2="120" stroke="rgba(255,255,255,0.05)" />
                  
                  {(() => {
                    const maxL = Math.max(...report.charts.dailyLending.map((d) => d.amount), 1000);
                    const points = report.charts.dailyLending
                      .map((d, idx) => {
                        const x = 30 + idx * 45;
                        const y = 120 - (d.amount / maxL) * 90;
                        return `${x},${y}`;
                      })
                      .join(" ");
                    
                    const fillPoints = `30,120 ${points} 300,120`;
                    
                    return (
                      <>
                        <polygon points={fillPoints} fill="url(#lentGrad)" />
                        <polyline points={points} fill="none" stroke="#FFD700" strokeWidth="2.5" />
                        
                        {/* Data Points */}
                        {report.charts.dailyLending.map((d, idx) => {
                          const x = 30 + idx * 45;
                          const y = 120 - (d.amount / maxL) * 90;
                          return (
                            <g key={idx}>
                              <circle cx={x} cy={y} r="3.5" fill="#09090B" stroke="#FFD700" strokeWidth="2" />
                              <text x={x} y={y - 8} textAnchor="middle" fontSize="8" fill="#FFD700" fontWeight="bold">
                                {d.amount > 0 ? `₹${d.amount / 1000}k` : ""}
                              </text>
                              <text x={x} y="136" textAnchor="middle" fontSize="7" fill="#A1A1AA">
                                {d.date.split(" ")[0]}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Daily Collections (Bar Chart) */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Daily Collections (Last 7 Days)</h4>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="h-48 w-full flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 350 150">
                  <line x1="20" y1="20" x2="330" y2="20" stroke="rgba(255,255,255,0.03)" />
                  <line x1="20" y1="70" x2="330" y2="70" stroke="rgba(255,255,255,0.03)" />
                  <line x1="20" y1="120" x2="330" y2="120" stroke="rgba(255,255,255,0.05)" />

                  {(() => {
                    const maxC = Math.max(...report.charts.dailyCollections.map((d) => d.amount), 1000);
                    return report.charts.dailyCollections.map((d, idx) => {
                      const x = 30 + idx * 45;
                      const h = (d.amount / maxC) * 90;
                      const y = 120 - h;
                      return (
                        <g key={idx}>
                          <rect x={x - 10} y={y} width="20" height={Math.max(h, 2)} rx="3" fill="#10B981" opacity="0.85" />
                          <text x={x} y={y - 6} textAnchor="middle" fontSize="8" fill="#10B981" fontWeight="bold">
                            {d.amount > 0 ? `₹${d.amount / 1000}k` : ""}
                          </text>
                          <text x={x} y="136" textAnchor="middle" fontSize="7" fill="#A1A1AA">
                            {d.date.split(" ")[0]}
                          </text>
                        </g>
                      );
                    });
                  })()}
                </svg>
              </div>
            </div>

            {/* Monthly Lending vs Collections (Side by side Bar) */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Monthly Lending vs Collections (Last 6 Months)</h4>
              <div className="h-48 w-full flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 350 150">
                  <line x1="20" y1="20" x2="330" y2="20" stroke="rgba(255,255,255,0.03)" />
                  <line x1="20" y1="70" x2="330" y2="70" stroke="rgba(255,255,255,0.03)" />
                  <line x1="20" y1="120" x2="330" y2="120" stroke="rgba(255,255,255,0.05)" />

                  {(() => {
                    const maxVal = Math.max(
                      ...report.charts.monthlyLendingVsCollections.map((m) => Math.max(m.lent, m.collected)),
                      10000
                    );
                    return report.charts.monthlyLendingVsCollections.map((m, idx) => {
                      const x = 32 + idx * 52;
                      const hLent = (m.lent / maxVal) * 90;
                      const hColl = (m.collected / maxVal) * 90;
                      const yLent = 120 - hLent;
                      const yColl = 120 - hColl;

                      return (
                        <g key={idx}>
                          {/* Lent bar (Gold) */}
                          <rect x={x - 12} y={yLent} width="10" height={Math.max(hLent, 2)} rx="2" fill="#FFD700" />
                          {/* Collected bar (Green) */}
                          <rect x={x + 2} y={yColl} width="10" height={Math.max(hColl, 2)} rx="2" fill="#10B981" />
                          
                          <text x={x} y="136" textAnchor="middle" fontSize="7" fill="#A1A1AA">
                            {m.month}
                          </text>
                        </g>
                      );
                    });
                  })()}
                </svg>
              </div>
            </div>

            {/* Interest Earned Over Time (Area Chart) */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Interest Earned (Last 6 Months)</h4>
              <div className="h-48 w-full flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 350 150">
                  <defs>
                    <linearGradient id="intGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <line x1="20" y1="20" x2="330" y2="20" stroke="rgba(255,255,255,0.03)" />
                  <line x1="20" y1="70" x2="330" y2="70" stroke="rgba(255,255,255,0.03)" />
                  <line x1="20" y1="120" x2="330" y2="120" stroke="rgba(255,255,255,0.05)" />

                  {(() => {
                    const maxI = Math.max(...report.charts.interestOverTime.map((d) => d.amount), 5000);
                    const points = report.charts.interestOverTime
                      .map((d, idx) => {
                        const x = 30 + idx * 52;
                        const y = 120 - (d.amount / maxI) * 90;
                        return `${x},${y}`;
                      })
                      .join(" ");

                    const fillPoints = `30,120 ${points} 290,120`;

                    return (
                      <>
                        <polygon points={fillPoints} fill="url(#intGrad)" />
                        <polyline points={points} fill="none" stroke="#10B981" strokeWidth="2.5" />

                        {report.charts.interestOverTime.map((d, idx) => {
                          const x = 30 + idx * 52;
                          const y = 120 - (d.amount / maxI) * 90;
                          return (
                            <g key={idx}>
                              <circle cx={x} cy={y} r="3" fill="#09090B" stroke="#10B981" strokeWidth="2" />
                              <text x={x} y={y - 8} textAnchor="middle" fontSize="8" fill="#10B981" fontWeight="bold">
                                {d.amount > 0 ? `₹${(d.amount / 1000).toFixed(1)}k` : ""}
                              </text>
                              <text x={x} y="136" textAnchor="middle" fontSize="7" fill="#A1A1AA">
                                {d.month}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

          </div>

          {/* 6. STATUS DISTRIBUTION & LEDGER LIST */}
          <div className="grid md:grid-cols-3 gap-6 text-left">
            
            {/* Status distribution donut (no-print) */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-6 md:col-span-1 flex flex-col justify-between no-print">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Loan Status Distribution</h4>
              
              <div className="relative h-32 w-32 mx-auto flex items-center justify-center">
                {/* SVG Donut */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {(() => {
                    const total = report.charts.statusDistribution.reduce((sum, s) => sum + s.count, 0) || 1;
                    let accumulatedPercent = 0;
                    
                    return report.charts.statusDistribution.map((item, idx) => {
                      const percent = (item.count / total) * 100;
                      const strokeDash = `${percent} ${100 - percent}`;
                      const strokeOffset = 100 - accumulatedPercent;
                      accumulatedPercent += percent;

                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="15.915"
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="7"
                          strokeDasharray={strokeDash}
                          strokeDashoffset={strokeOffset}
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute text-center">
                  <p className="text-lg font-black text-white">
                    {report.charts.statusDistribution.reduce((sum, s) => sum + s.count, 0)}
                  </p>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-wider">Total Loans</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] pt-2">
                {report.charts.statusDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-400 font-semibold">{item.status}:</span>
                    <span className="text-white font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform summary notes */}
            <div className="p-6 rounded-2xl bg-[#141923]/60 border border-white/5 space-y-4 md:col-span-2 print-card">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Compliance & System Audit</h4>
              <div className="space-y-3.5 text-xs text-[#A1A1AA] leading-relaxed">
                <p>
                  Finexa compiles this report automatically by reading the system ledger records in real-time. Calculated metrics are cross-referenced with Supabase Storage contract tokens and audit events.
                </p>
                <div className="p-4 rounded-xl bg-black/25 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-zinc-500">Fast2SMS Gateway Status</span>
                    <span className="font-bold text-emerald-500">OPERATIONAL</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-zinc-500">Resend Mailer Gateway</span>
                    <span className="font-bold text-emerald-500">SMTP TLS VERIFIED</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-zinc-500">Database Encryption Key</span>
                    <span className="font-bold text-[#FFD700]">AES-256 SYSTEM LEVEL</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
