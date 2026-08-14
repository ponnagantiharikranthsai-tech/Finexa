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
  DollarSign, Wallet, Users, ArrowUpLeft, ArrowDownRight, Coins, Info
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

  // Mobile number lookup for existing funder during Add Funder form
  const matchedExistingFunder = React.useMemo(() => {
    const cleanSubmitted = mobile.replace(/[^0-9]/g, "").slice(-10);
    if (cleanSubmitted.length < 10) return null;
    return data.funders.find((f) => {
      const cleanDb = f.mobile.replace(/[^0-9]/g, "").slice(-10);
      return cleanDb === cleanSubmitted;
    }) || null;
  }, [mobile, data.funders]);

  // Auto-fill Name and Address when an existing funder is matched
  useEffect(() => {
    if (matchedExistingFunder) {
      if (!name) setName(matchedExistingFunder.name);
      if (!address) setAddress(matchedExistingFunder.address);
    }
  }, [matchedExistingFunder]);

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

  // Overview Date Filtering Logics
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
    const returned = filteredReturns.reduce((sum, r) => sum + Number(r.amount), 0);
    const activeCapital = Math.max(0, received - returned);

    const activeFundersCount = new Set(filteredFunders.filter((f) => f.status === "active").map((f) => f.mobile)).size;

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

  // Funders Tab Filtering Logics
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

  // Modals Trigger Handlers
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
        toast.success(res.message || "Funder investment registered successfully!");
        setAddOpen(false);
        resetFunderForm();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to create funder investment profile");
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
        toast.success("Investment details updated!");
        setEditOpen(false);
        resetFunderForm();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update investment profile");
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
    if (!confirm(`Are you sure you want to delete investment record for "${funderName}"? This action is permanent.`)) return;

    startTransition(async () => {
      const res = await deleteFunderAction(funderId);
      if (res.success) {
        toast.success(`Investment record for "${funderName}" deleted successfully.`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete investment record");
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

  // Find all sibling investments for selectedFunder in View Details dialog
  const sameFunderAllInvestments = React.useMemo(() => {
    if (!selectedFunder) return [];
    const cleanTarget = selectedFunder.mobile.replace(/[^0-9]/g, "").slice(-10);
    return data.funders.filter((f) => {
      const cleanDb = f.mobile.replace(/[^0-9]/g, "").slice(-10);
      return cleanDb === cleanTarget;
    });
  }, [selectedFunder, data.funders]);

  return (
    <div className="space-y-6">
      {/* ── TOP STATS CARDS GRID ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total Capital Received */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-primary/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Received</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-foreground tracking-tight">
              ₹{data.stats.totalReceived.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Across all funder investments</p>
          </div>
        </div>

        {/* Total Capital Returned */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-emerald-500/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Returned</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ArrowUpLeft className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-emerald-500 tracking-tight">
              ₹{data.stats.totalReturned.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Capital repaid back to partners</p>
          </div>
        </div>

        {/* Active Capital Pool */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-amber-500/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Capital</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-amber-500 tracking-tight">
              ₹{data.stats.activeCapital.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Current net active funder pool</p>
          </div>
        </div>

        {/* Available Liquidity Pool */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-blue-500/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Available Pool</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-blue-400 tracking-tight">
              ₹{data.stats.availableCapital.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Unallocated liquid capital</p>
          </div>
        </div>
      </div>

      {/* ── CONTROLS & TABS BAR ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-card/80 p-1.5 rounded-2xl border border-border/50 shadow-inner">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 fx-pressable ${
              activeTab === "overview"
                ? "fx-brand-gradient text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            }`}
          >
            Overview & Audit
          </button>
          <button
            onClick={() => setActiveTab("funders")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 fx-pressable ${
              activeTab === "funders"
                ? "fx-brand-gradient text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            }`}
          >
            Funder Portfolios ({data.funders.length})
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              resetFunderForm();
              setAddOpen(true);
            }}
            className="h-10 px-4 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable shadow-md"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Investment
          </Button>
        </div>
      </div>

      {/* ── TAB 1: OVERVIEW & AUDIT SUMMARY ───────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Filters Bar for Overview */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-card/60 border border-border/50">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Report Window:</span>
              <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border/40 text-xs">
                {(["today", "month", "year", "custom"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setReportRange(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                      reportRange === r ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {reportRange === "custom" && (
              <div className="flex items-center gap-2 text-xs">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 rounded-lg text-xs bg-transparent border-border"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 rounded-lg text-xs bg-transparent border-border"
                />
              </div>
            )}
          </div>

          {/* Filtered Report Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-md space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Capital Inflow (Window)</span>
              <p className="text-2xl font-black text-foreground">₹{reportStats.received.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-muted-foreground">Total investments raised in selected period</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-md space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Capital Outflow (Window)</span>
              <p className="text-2xl font-black text-emerald-500">₹{reportStats.returned.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-muted-foreground">Total repayments returned to funders in window</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-md space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Active Funder Partners</span>
              <p className="text-2xl font-black text-amber-500">{reportStats.activeFundersCount}</p>
              <p className="text-[11px] text-muted-foreground">Unique active capital providers</p>
            </div>
          </div>

          {/* Recently Added Investments */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-md space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Recent Capital Inflows</span>
            </h3>

            {reportStats.recentlyAdded.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No investments found in selected report window.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {reportStats.recentlyAdded.map((funder) => (
                  <div key={funder.funderId} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <p className="font-bold text-foreground flex items-center gap-2">
                        <span>{funder.name}</span>
                        {(funder.totalFunderInvestments || 1) > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black">
                            Investment #{funder.investmentIndex} of {funder.totalFunderInvestments}
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground mt-0.5">{funder.mobile} • {funder.investmentDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-foreground">₹{funder.capitalAmount.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-muted-foreground">Due: {funder.returnDueDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: FUNDERS PORTFOLIOS ────────────────────────────────────────── */}
      {activeTab === "funders" && (
        <div className="space-y-4">
          {/* Search & Status Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-card/60 border border-border/50">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search funder name or mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-transparent border-border text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
                <SelectTrigger className="h-10 rounded-xl bg-transparent border-border text-xs w-full sm:w-44">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="returned">Returned Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Funders Cards List Grid */}
          {filteredFunders.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-card border border-border">
              <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-bold text-foreground">No Funder Investments Found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search criteria or register a new investment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFunders.map((funder) => {
                const timeline = getTimelineText(funder);
                const isReturned = funder.status === "returned";
                const cardGlow = isReturned ? "border-emerald-500/20" : "border-border/60 hover:border-primary/40";
                const hasMultiple = (funder.totalFunderInvestments || 1) > 1;

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
                        <div className="flex flex-col items-end gap-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isReturned
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {isReturned ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {isReturned ? "Returned" : "Active"}
                          </span>

                          {hasMultiple && (
                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase">
                              Inv #{funder.investmentIndex} of {funder.totalFunderInvestments}
                            </span>
                          )}
                        </div>
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

                      {hasMultiple && (
                        <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-500 flex items-center justify-between">
                          <span>Total Funder Portfolio:</span>
                          <strong>₹{funder.totalFunderCapitalProvided?.toLocaleString("en-IN")}</strong>
                        </div>
                      )}
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
                        title="Edit Investment"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteFunder(funder.funderId, funder.name, e)}
                        disabled={isPending}
                        className="p-2 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-550/10 transition-all duration-200"
                        title="Delete Investment Record"
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

      {/* ── MODAL: ADD NEW INVESTMENT ────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Register Investment</DialogTitle>
            <DialogDescription>
              Add capital funding investment record. Multiple investments for the same funder are supported.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
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
              {matchedExistingFunder && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-start gap-2 mt-1">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                  <span>Existing funder profile found ({matchedExistingFunder.name}). A new investment will be added to this funder's portfolio.</span>
                </div>
              )}
            </div>

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
                {isPending ? "Saving..." : "Save Investment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: EDIT INVESTMENT ────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Edit Investment Record</DialogTitle>
            <DialogDescription>
              Update information for this specific capital investment.
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
              Record capital repayments returned back to <strong>{selectedFunder?.name}</strong> for Investment #{selectedFunder?.investmentIndex || 1}.
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
                  Outstanding Balance for this Investment: <strong>₹{selectedFunder.remainingCapital.toLocaleString("en-IN")}</strong>
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
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto fx-glass-card border-border/50 bg-white dark:bg-card p-6 text-left">
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

              {/* Funder Portfolio Summary (Multi-Investment View) */}
              {sameFunderAllInvestments.length > 1 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-amber-500 flex items-center gap-1.5">
                    <Coins className="h-4 w-4" /> Funder Portfolio Summary ({sameFunderAllInvestments.length} Investments)
                  </h3>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                      <span className="text-muted-foreground">Total Portfolio Capital Provided:</span>
                      <strong className="text-amber-500 text-sm font-black">
                        ₹{selectedFunder.totalFunderCapitalProvided?.toLocaleString("en-IN")}
                      </strong>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">All Investments List:</p>
                      <div className="divide-y divide-amber-500/20">
                        {sameFunderAllInvestments.map((inv, idx) => (
                          <div key={inv.funderId} className="py-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-foreground">Investment #{idx + 1}</span>
                              <span className="text-[10px] text-muted-foreground block">Date: {inv.investmentDate} | Due: {inv.returnDueDate}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-foreground">₹{inv.capitalAmount.toLocaleString("en-IN")}</span>
                              <span className={`text-[10px] font-bold block uppercase ${inv.status === "returned" ? "text-emerald-400" : "text-amber-400"}`}>
                                {inv.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Current Investment Details */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                  <Coins className="h-4 w-4" /> Selected Investment Record Details
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
                    No capital returns recorded for this specific investment.
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
