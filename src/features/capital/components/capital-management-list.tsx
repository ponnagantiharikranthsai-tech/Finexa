"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search, Plus, Landmark, Calendar, RefreshCw, ChevronRight,
  Trash2, Mail, FileText, MapPin, User, Edit, Clock,
  Check, CheckCircle2, XCircle, ChevronDown, ListFilter,
  DollarSign, Wallet, Users, ArrowUpLeft, ArrowDownRight, Coins
} from "lucide-react";
import { createFunderAction } from "../actions/create-funder.action";
import { updateFunderAction } from "../actions/update-funder.action";
import { deleteFunderAction } from "../actions/delete-funder.action";
import { recordCapitalReturnAction } from "../actions/record-capital-return.action";
import type { FunderWithReturns } from "../actions/get-capital-data.action";
import { differenceInDays } from "date-fns";

interface CapitalManagementListProps {
  initialData: {
    funders: FunderWithReturns[];
    stats: {
      totalReceived: number;
      totalReturned: number;
      activeCapital: number;
      availableCapital: number;
      activeFunders: number;
      totalOutstandingLoansPrincipal: number;
    };
  };
}

export function CapitalManagementList({ initialData }: CapitalManagementListProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<"overview" | "funders">("overview");

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Reports date range states
  const [reportRange, setReportRange] = useState<"today" | "month" | "year" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [selectedFunder, setSelectedFunder] = useState<FunderWithReturns | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [capitalAmount, setCapitalAmount] = useState("");
  const [investmentDate, setInvestmentDate] = useState(new Date().toISOString().split("T")[0]!);
  const [returnDueDate, setReturnDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Return Capital form states
  const [returnAmount, setReturnAmount] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]!);
  const [returnNotes, setReturnNotes] = useState("");

  // Sync initialData
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Calculations for timelines
  const todayStr = new Date().toISOString().split("T")[0]!;
  const today = new Date(todayStr);

  const getTimelineText = (funder: FunderWithReturns) => {
    if (funder.status === "returned") {
      return { text: "Fully Returned", color: "text-emerald-400" };
    }
    const dueDate = new Date(funder.returnDueDate);
    const diff = differenceInDays(dueDate, today);

    if (diff < 0) {
      return { text: `${Math.abs(diff)} Days Overdue`, color: "text-red-400 font-bold" };
    }
    if (diff === 0) {
      return { text: "Due Today", color: "text-blue-400 font-bold animate-[pulse_2s_infinite]" };
    }
    return { text: `${diff} Days Remaining`, color: "text-amber-400" };
  };

  // ── Overview Date Filtering Logics ──────────────────────────────────────────
  const getFilteredReportStats = () => {
    let start: Date | null = null;
    let end: Date | null = null;
    const now = new Date();

    if (reportRange === "today") {
      const todayStr = now.toISOString().split("T")[0]!;
      start = new Date(todayStr);
      end = new Date(todayStr + "T23:59:59.999Z");
    } else if (reportRange === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (reportRange === "year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 12, 0, 23, 59, 59, 999);
    } else if (reportRange === "custom") {
      if (customStart) start = new Date(customStart);
      if (customEnd) end = new Date(customEnd + "T23:59:59.999Z");
    }

    const filteredFunders = data.funders.filter((f) => {
      const invDate = new Date(f.investmentDate);
      if (start && invDate < start) return false;
      if (end && invDate > end) return false;
      return true;
    });

    const allReturns = data.funders.flatMap((f) =>
      f.returnsList.map((r) => ({ ...r, funderId: f.funderId }))
    );

    const filteredReturns = allReturns.filter((r) => {
      const retDate = new Date(r.returnDate);
      if (start && retDate < start) return false;
      if (end && retDate > end) return false;
      return true;
    });

    const received = filteredFunders.reduce((sum, f) => sum + f.capitalAmount, 0);
    const returned = filteredReturns.reduce((sum, r) => sum + r.amount, 0);
    const activeCapital = Math.max(0, received - returned);
    const activeFundersCount = filteredFunders.filter((f) => f.status === "active").length;

    // Recently added funders list
    const recentlyAdded = [...filteredFunders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      received,
      returned,
      activeCapital,
      activeFundersCount,
      recentlyAdded,
    };
  };

  const reportStats = getFilteredReportStats();

  // ── Funders Tab Filtering Logics ───────────────────────────────────────────
  const filteredFunders = data.funders.filter((funder) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const matchName = funder.name.toLowerCase().includes(q);
      const matchMobile = funder.mobile.toLowerCase().includes(q);
      if (!matchName && !matchMobile) return false;
    }

    if (statusFilter !== "all" && funder.status !== statusFilter) {
      return false;
    }

    return true;
  });

  // ── Modals Trigger Handlers ──────────────────────────────────────────────────
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", name);
    fd.append("mobile", mobile);
    fd.append("address", address);
    fd.append("capitalAmount", capitalAmount);
    fd.append("investmentDate", investmentDate);
    fd.append("returnDueDate", returnDueDate);
    fd.append("notes", notes);

    startTransition(async () => {
      const res = await createFunderAction(null, fd);
      if (res.success) {
        toast.success("Funder registered successfully!");
        setAddOpen(false);
        resetFunderForm();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to create funder profile");
      }
    });
  };

  const handleEditOpen = (funder: FunderWithReturns, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFunder(funder);
    setName(funder.name);
    setMobile(funder.mobile);
    setAddress(funder.address);
    setCapitalAmount(funder.capitalAmount.toString());
    setInvestmentDate(funder.investmentDate);
    setReturnDueDate(funder.returnDueDate);
    setNotes(funder.notes || "");
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunder) return;

    const fd = new FormData();
    fd.append("funderId", selectedFunder.funderId);
    fd.append("name", name);
    fd.append("mobile", mobile);
    fd.append("address", address);
    fd.append("capitalAmount", capitalAmount);
    fd.append("investmentDate", investmentDate);
    fd.append("returnDueDate", returnDueDate);
    fd.append("notes", notes);

    startTransition(async () => {
      const res = await updateFunderAction(null, fd);
      if (res.success) {
        toast.success("Funder details updated!");
        setEditOpen(false);
        resetFunderForm();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update funder profile");
      }
    });
  };

  const handleReturnOpen = (funder: FunderWithReturns, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFunder(funder);
    setReturnAmount(funder.remainingCapital.toString());
    setReturnNotes("");
    setReturnOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunder) return;

    const fd = new FormData();
    fd.append("funderId", selectedFunder.funderId);
    fd.append("amount", returnAmount);
    fd.append("returnDate", returnDate);
    fd.append("notes", returnNotes);

    startTransition(async () => {
      const res = await recordCapitalReturnAction(null, fd);
      if (res.success) {
        toast.success(`Capital return of ₹${Number(returnAmount).toLocaleString("en-IN")} recorded!`);
        setReturnOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to record capital return");
      }
    });
  };

  const handleDeleteFunder = async (funderId: string, funderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete funder "${funderName}"? This action is permanent.`)) return;

    startTransition(async () => {
      const res = await deleteFunderAction(funderId);
      if (res.success) {
        toast.success(`Funder profile "${funderName}" deleted successfully.`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete funder");
      }
    });
  };

  const handleViewDetails = (funder: FunderWithReturns) => {
    setSelectedFunder(funder);
    setDetailsOpen(true);
  };

  const resetFunderForm = () => {
    setName("");
    setMobile("");
    setAddress("");
    setCapitalAmount("");
    setInvestmentDate(new Date().toISOString().split("T")[0]!);
    setReturnDueDate("");
    setNotes("");
    setSelectedFunder(null);
  };

  return (
    <div className="space-y-6">
      {/* ── Dashboard Summary (5 Cards Grid) ─────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {/* Total Capital Received */}
        <div className="fx-glass-card border border-border/40 p-4 rounded-2xl flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Coins className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Received</p>
            <p className="text-lg font-black text-foreground mt-0.5">
              ₹{data.stats.totalReceived.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Total Capital Returned */}
        <div className="fx-glass-card border border-border/40 p-4 rounded-2xl flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <ArrowDownRight className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Returned</p>
            <p className="text-lg font-black text-foreground mt-0.5">
              ₹{data.stats.totalReturned.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Active Capital */}
        <div className="fx-glass-card border border-border/40 p-4 rounded-2xl flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Wallet className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Capital</p>
            <p className="text-lg font-black text-amber-400 mt-0.5">
              ₹{data.stats.activeCapital.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Available Capital */}
        <div className="fx-glass-card border border-border/40 p-4 rounded-2xl flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Available Capital</p>
            <p className="text-lg font-black text-emerald-400 mt-0.5">
              ₹{data.stats.availableCapital.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Active Funders */}
        <div className="fx-glass-card border border-border/40 p-4 rounded-2xl flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
            <Users className="h-4.5 w-4.5 text-purple-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Funders</p>
            <p className="text-lg font-black text-foreground mt-0.5">
              {data.stats.activeFunders}
            </p>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex border-b border-border/40 pb-px">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-5 py-3 text-sm font-bold tracking-tight border-b-2 transition-all duration-150 ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview & Reports
        </button>
        <button
          onClick={() => setActiveTab("funders")}
          className={`px-5 py-3 text-sm font-bold tracking-tight border-b-2 transition-all duration-150 ${
            activeTab === "funders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Funders Portfolio ({data.funders.length})
        </button>
      </div>

      {/* ── TAB 1: OVERVIEW & REPORTS ────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="fx-glass-card border border-border/30 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-foreground">Interactive Capital Reports</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Filter capital flow parameters dynamically across date brackets.
                </p>
              </div>

              {/* Date Filters Toggle */}
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={reportRange}
                  onValueChange={(val: any) => setReportRange(val)}
                >
                  <SelectTrigger className="h-10 w-40 rounded-xl border-border bg-transparent text-xs font-semibold text-foreground">
                    <SelectValue placeholder="Select Range" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-white dark:bg-card">
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>

                {reportRange === "custom" && (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-10 w-32 rounded-xl text-xs bg-transparent border-border"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-10 w-32 rounded-xl text-xs bg-transparent border-border"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Filtered Statistics Summary Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 pt-2">
              <div className="bg-black/10 dark:bg-black/25 p-4 rounded-xl border border-white/[0.01]">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Capital Received</span>
                <p className="text-lg font-black text-foreground mt-1">
                  ₹{reportStats.received.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-black/10 dark:bg-black/25 p-4 rounded-xl border border-white/[0.01]">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Capital Returned</span>
                <p className="text-lg font-black text-foreground mt-1">
                  ₹{reportStats.returned.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-black/10 dark:bg-black/25 p-4 rounded-xl border border-white/[0.01]">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Capital Flow</span>
                <p className="text-lg font-black text-amber-400 mt-1">
                  ₹{reportStats.activeCapital.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-black/10 dark:bg-black/25 p-4 rounded-xl border border-white/[0.01]">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Funders</span>
                <p className="text-lg font-black text-foreground mt-1">
                  {reportStats.activeFundersCount}
                </p>
              </div>
            </div>

            {/* Recently Added Funders */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 pt-2">
                <Clock className="h-4 w-4 text-primary" /> Recently Added Funders ({reportStats.recentlyAdded.length})
              </h3>

              {reportStats.recentlyAdded.length === 0 ? (
                <div className="py-10 text-center bg-black/10 dark:bg-black/25 rounded-xl text-xs text-muted-foreground">
                  No funders added within this date range.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border/30 rounded-xl bg-black/10 dark:bg-black/25">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/30 bg-white/5">
                        <th className="p-3 font-bold text-muted-foreground uppercase">Funder Name</th>
                        <th className="p-3 font-bold text-muted-foreground uppercase">Mobile</th>
                        <th className="p-3 font-bold text-muted-foreground uppercase">Capital Invested</th>
                        <th className="p-3 font-bold text-muted-foreground uppercase">Investment Date</th>
                        <th className="p-3 font-bold text-muted-foreground uppercase">Return Due Date</th>
                        <th className="p-3 font-bold text-muted-foreground uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {reportStats.recentlyAdded.map((f) => (
                        <tr
                          key={f.funderId}
                          onClick={() => handleViewDetails(f)}
                          className="hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <td className="p-3 font-semibold text-foreground">{f.name}</td>
                          <td className="p-3 text-muted-foreground">{f.mobile}</td>
                          <td className="p-3 font-bold text-foreground">₹{f.capitalAmount.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(f.investmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(f.returnDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              f.status === "active" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            }`}>
                              {f.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: FUNDERS PORTFOLIO ─────────────────────────────────────────── */}
      {activeTab === "funders" && (
        <div className="space-y-5">
          {/* Filters and Actions Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* Search box */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search name, mobile number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
                />
              </div>

              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
                <SelectTrigger className="h-11 w-40 rounded-xl border-border bg-transparent text-sm font-semibold text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-white dark:bg-card">
                  <SelectItem value="all">All Funders</SelectItem>
                  <SelectItem value="active">Active Status</SelectItem>
                  <SelectItem value="returned">Returned Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Add Funder Button */}
            <Button
              onClick={() => { resetFunderForm(); setAddOpen(true); }}
              className="h-11 px-4 rounded-xl gap-2 fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable text-sm font-bold w-full md:w-auto"
            >
              <Plus className="h-4 w-4" /> Add New Funder
            </Button>
          </div>

          {/* Sync status logging */}
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            {isPending ? (
              <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Synchronizing changes...</span>
            ) : (
              <span>Showing {filteredFunders.length} of {data.funders.length} funder profiles</span>
            )}
          </div>

          {/* Funders Grid */}
          {filteredFunders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center fx-glass-card rounded-[22px] border border-border">
              <div className="h-14 w-14 bg-secondary rounded-2xl flex items-center justify-center mb-4 border border-border">
                <Coins className="h-7 w-7 text-primary" />
              </div>
              <p className="font-bold text-foreground">No records matched</p>
              <p className="text-xs text-muted-foreground mt-1">Try checking your search parameters or select filters.</p>
            </div>
          ) : (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFunders.map((funder) => {
                const timeline = getTimelineText(funder);
                const isReturned = funder.status === "returned";

                // Card Glow based on status
                const cardGlow = isReturned
                  ? "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] border-emerald-500/15 shadow-[0_0_12px_-3px_rgba(16,185,129,0.12)] hover:shadow-[0_0_20px_0_rgba(16,185,129,0.2)]"
                  : "bg-amber-500/[0.02] hover:bg-amber-500/[0.04] border-amber-500/20 shadow-[0_0_15px_-3px_rgba(212,175,55,0.15)] hover:shadow-[0_0_22px_0_rgba(212,175,55,0.22)]";

                return (
                  <div
                    key={funder.funderId}
                    className={`flex flex-col justify-between h-full fx-glass-card rounded-[22px] p-5 border transition-all duration-300 ease-out fx-3d-hover ${cardGlow}`}
                  >
                    {/* Header profile row */}
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl fx-brand-gradient flex items-center justify-center text-white font-black text-sm shrink-0 fx-shadow-glow-sm">
                            {funder.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-left min-w-0">
                            <p className="font-semibold text-sm text-foreground tracking-tight truncate max-w-[130px]">{funder.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{funder.mobile}</p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isReturned
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {isReturned ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {isReturned ? "Returned" : "Active"}
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3 bg-black/15 dark:bg-black/35 p-3.5 rounded-xl border border-white/[0.02] text-left text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Capital Invested</p>
                          <p className="font-extrabold text-foreground mt-0.5">₹{funder.capitalAmount.toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Returned Amount</p>
                          <p className="font-extrabold text-foreground mt-0.5">₹{funder.totalReturned.toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Return Due Date</p>
                          <p className="font-semibold text-foreground mt-0.5">
                            {new Date(funder.returnDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Timeline</p>
                          <p className={`font-semibold mt-0.5 ${timeline.color}`}>
                            {timeline.text}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-4 mt-4 border-t border-white/[0.03]">
                      {!isReturned && (
                        <button
                          onClick={(e) => handleReturnOpen(funder, e)}
                          className="flex-1 min-w-[50px] flex items-center justify-center gap-1 h-9 rounded-xl bg-secondary hover:bg-accent/40 text-primary text-xs font-bold transition-all duration-200 fx-pressable"
                        >
                          <ArrowUpLeft className="h-3.5 w-3.5" /> Return Capital
                        </button>
                      )}

                      <button
                        onClick={() => handleViewDetails(funder)}
                        className="flex-1 min-w-[70px] flex items-center justify-center gap-1 h-9 rounded-xl bg-accent/25 hover:bg-accent/50 text-foreground text-xs font-semibold transition-all duration-200"
                      >
                        View
                      </button>

                      <button
                        onClick={(e) => handleEditOpen(funder, e)}
                        className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                        title="Edit Funder"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteFunder(funder.funderId, funder.name, e)}
                        disabled={isPending}
                        className="p-2 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-550/10 transition-all duration-200"
                        title="Delete Funder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ADD NEW FUNDER ────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Register New Funder</DialogTitle>
            <DialogDescription>
              Add details of the capital partner providing business funding.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Funder Name*</Label>
              <Input
                type="text"
                placeholder="Funder Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number*</Label>
              <Input
                type="tel"
                placeholder="Mobile number (10 digits)"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address*</Label>
              <Input
                type="text"
                placeholder="Residential or Office Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Investment Amount (₹)*</Label>
                <Input
                  type="number"
                  placeholder="₹10,000"
                  value={capitalAmount}
                  onChange={(e) => setCapitalAmount(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Investment Date*</Label>
                <Input
                  type="date"
                  value={investmentDate}
                  onChange={(e) => setInvestmentDate(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Return Due Date*</Label>
              <Input
                type="date"
                value={returnDueDate}
                onChange={(e) => setReturnDueDate(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (Optional)</Label>
              <Textarea
                placeholder="Funder specifications, investment schedules, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl min-h-[80px] bg-transparent border-border fx-input-glass text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                className="h-11 rounded-xl text-xs font-bold border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-cta-glow px-5"
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: EDIT FUNDER ───────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Edit Funder Profile</DialogTitle>
            <DialogDescription>
              Modify name, address, capital amount, or timeline targets.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Funder Name*</Label>
              <Input
                type="text"
                placeholder="Funder Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number*</Label>
              <Input
                type="tel"
                placeholder="Mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address*</Label>
              <Input
                type="text"
                placeholder="Residential or Office Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Investment Amount (₹)*</Label>
                <Input
                  type="number"
                  placeholder="₹10,000"
                  value={capitalAmount}
                  onChange={(e) => setCapitalAmount(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Investment Date*</Label>
                <Input
                  type="date"
                  value={investmentDate}
                  onChange={(e) => setInvestmentDate(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Return Due Date*</Label>
              <Input
                type="date"
                value={returnDueDate}
                onChange={(e) => setReturnDueDate(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (Optional)</Label>
              <Textarea
                placeholder="Funder specifications..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl min-h-[80px] bg-transparent border-border fx-input-glass text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="h-11 rounded-xl text-xs font-bold border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-cta-glow px-5"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: RETURN CAPITAL ────────────────────────────────────────────── */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Return Capital</DialogTitle>
            <DialogDescription>
              Record capital repayments returned back to <strong>{selectedFunder?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Repayment Amount (₹)*</Label>
              <Input
                type="number"
                placeholder="₹10,000"
                value={returnAmount}
                onChange={(e) => setReturnAmount(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
              {selectedFunder && (
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Funder Outstanding Balance: <strong>₹{selectedFunder.remainingCapital.toLocaleString("en-IN")}</strong>
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Return Date*</Label>
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (Optional)</Label>
              <Textarea
                placeholder="Details of capital return (Bank transaction hash, cash vouchers, etc.)"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                className="rounded-xl min-h-[80px] bg-transparent border-border fx-input-glass text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturnOpen(false)}
                className="h-11 rounded-xl text-xs font-bold border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-cta-glow px-5"
              >
                {isPending ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: VIEW DETAILS ──────────────────────────────────────────────── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="rounded-2xl max-w-xl max-h-[85vh] overflow-y-auto fx-glass-card border-border/50 bg-white dark:bg-card p-6 text-left">
          {selectedFunder && (
            <div className="space-y-6">
              <DialogHeader className="border-b border-border/40 pb-4">
                <DialogTitle className="text-xl font-black tracking-tight flex items-center justify-between">
                  <span>Funder Master Audit File</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedFunder.status === "returned" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {selectedFunder.status}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Verify capital provider metrics and return transaction ledger.
                </DialogDescription>
              </DialogHeader>

              {/* Funder Personal Info */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-accent/20 dark:bg-secondary/10 p-4 rounded-xl border border-border/30 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Full Name</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedFunder.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Mobile Number</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedFunder.mobile}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Address</span>
                    <p className="font-semibold text-foreground mt-0.5">{selectedFunder.address}</p>
                  </div>
                </div>
              </div>

              {/* Funder Capital Details */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                  <Coins className="h-4 w-4" /> Capital Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-accent/20 dark:bg-secondary/10 p-4 rounded-xl border border-border/30 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Capital Invested</span>
                    <p className="font-extrabold text-foreground mt-0.5">₹{selectedFunder.capitalAmount.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Capital Returned</span>
                    <p className="font-extrabold text-foreground mt-0.5">₹{selectedFunder.totalReturned.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Remaining Capital</span>
                    <p className="font-extrabold text-amber-400 mt-0.5">₹{selectedFunder.remainingCapital.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Return Due Date</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {new Date(selectedFunder.returnDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Funder Notes */}
              {selectedFunder.notes && (
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Notes
                  </h3>
                  <div className="bg-accent/20 dark:bg-secondary/10 p-3.5 rounded-xl border border-border/30 text-xs text-muted-foreground leading-relaxed">
                    {selectedFunder.notes}
                  </div>
                </div>
              )}

              {/* Funder Return History Ledger */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                  <Landmark className="h-4 w-4" /> Capital Return History ({selectedFunder.returnsList.length})
                </h3>

                {selectedFunder.returnsList.length === 0 ? (
                  <div className="py-6 text-center bg-accent/15 dark:bg-secondary/10 rounded-xl text-xs text-muted-foreground">
                    No capital returns recorded for this funder.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border/30 rounded-xl bg-accent/15 dark:bg-secondary/10">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/30 bg-white/5">
                          <th className="p-3 font-bold text-muted-foreground uppercase">Repayment Amount</th>
                          <th className="p-3 font-bold text-muted-foreground uppercase">Date Returned</th>
                          <th className="p-3 font-bold text-muted-foreground uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {selectedFunder.returnsList.map((ret) => (
                          <tr key={ret.returnId}>
                            <td className="p-3 font-bold text-foreground">₹{ret.amount.toLocaleString("en-IN")}</td>
                            <td className="p-3 text-muted-foreground">
                              {new Date(ret.returnDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="p-3 text-muted-foreground truncate max-w-[200px]" title={ret.notes || ""}>
                              {ret.notes || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border/40 flex justify-end">
                <Button
                  onClick={() => setDetailsOpen(false)}
                  className="h-10 rounded-xl text-xs font-bold bg-secondary hover:bg-accent/40 text-foreground"
                >
                  Close Detailed View
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
