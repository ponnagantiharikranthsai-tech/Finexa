"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search, Plus, Landmark, Calendar, RefreshCw, ChevronRight,
  Trash2, Mail, FileText, MapPin, User, Edit, Clock,
  Check, CheckCircle2, XCircle, ListFilter,
  DollarSign, Wallet, Users, ArrowUpLeft, ArrowDownRight, Coins, Info,
  CreditCard, ExternalLink, ShieldCheck, UserPlus, History,
  RotateCcw, BadgeCheck
} from "lucide-react";
import { createFunderAction } from "../actions/create-funder.action";
import { updateFunderAction } from "../actions/update-funder.action";
import { deleteFunderAction } from "../actions/delete-funder.action";
import { recordCapitalReturnAction } from "../actions/record-capital-return.action";
import { recordReceivedCapitalAction } from "../actions/record-received-capital.action";
import type { FunderWithReturns, FundingTransactionHistoryItem } from "../actions/get-capital-data.action";

interface CapitalManagementListProps {
  initialData: {
    funders: FunderWithReturns[];
    stats: {
      totalReceived: number;
      totalProvided: number;
      currentlyAllocated: number;
      returnedFromBorrower?: number;
      paidBackToCapitalPerson?: number;
      capitalPayable?: number;
      unallocatedReceived: number;
      totalReturned: number;
      activeCapital: number;
      availableCapital: number;
      activeFunders: number;
      totalAllocated?: number;
      totalCapitalWithBorrowers?: number;
      totalOutstandingLoansPrincipal: number;
    };
  };
}

const fmt = (val: number | string | undefined | null) => (Number(val) || 0).toLocaleString("en-IN");

export function CapitalManagementList({ initialData }: CapitalManagementListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<"funders" | "overview">("funders");

  // Defensively normalize stats
  const stats = {
    totalProvided: Number(data?.stats?.totalProvided ?? 0),
    currentlyAllocated: Number(data?.stats?.currentlyAllocated ?? 0),
    returnedFromBorrower: Number(data?.stats?.returnedFromBorrower ?? 0),
    paidBackToCapitalPerson: Number(data?.stats?.paidBackToCapitalPerson ?? data?.stats?.totalReturned ?? 0),
    capitalPayable: Number(data?.stats?.capitalPayable ?? 0) > 0
      ? Number(data?.stats?.capitalPayable)
      : Math.max(0, Number(data?.stats?.totalProvided ?? 0) - Number(data?.stats?.currentlyAllocated ?? 0) - Number(data?.stats?.paidBackToCapitalPerson ?? 0)),
    unallocatedReceived: Number(data?.stats?.unallocatedReceived ?? 0),
    activeFunders: Number(data?.stats?.activeFunders ?? 0),
  };

  // Defensively normalize funders list
  const fundersList: FunderWithReturns[] = (data?.funders || []).map((f) => ({
    ...f,
    totalProvided: Number(f.totalProvided ?? f.capitalAmount ?? 0),
    currentlyAllocated: Number(f.currentlyAllocated ?? 0),
    returnedFromBorrower: Number(f.returnedFromBorrower ?? 0),
    paidBackToCapitalPerson: Number(f.paidBackToCapitalPerson ?? f.totalReturned ?? 0),
    capitalPayable: Math.max(
      0,
      Number(f.capitalPayable ?? 0) > 0
        ? Number(f.capitalPayable)
        : Math.max(0, (Number(f.unallocatedReceived) || 0) + (Number(f.returnedFromBorrower) || 0) - (Number(f.paidBackToCapitalPerson ?? f.totalReturned) || 0)) ||
          Math.max(0, (Number(f.totalProvided ?? f.capitalAmount) || 0) - (Number(f.currentlyAllocated) || 0) - (Number(f.paidBackToCapitalPerson ?? f.totalReturned) || 0))
    ),
    unallocatedReceived: Number(f.unallocatedReceived ?? 0),
    fundingHistory: Array.isArray(f.fundingHistory) ? f.fundingHistory : [],
    loansFunded: Array.isArray(f.loansFunded) ? f.loansFunded : [],
    returnsList: Array.isArray(f.returnsList) ? f.returnsList : [],
  }));

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [selectedFunder, setSelectedFunder] = useState<FunderWithReturns | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [recordReceivedOpen, setRecordReceivedOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Form states (Add/Edit Capital Person)
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Record Received Capital form states
  const [receivedFunderId, setReceivedFunderId] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]!);
  const [receivedNotes, setReceivedNotes] = useState("");

  // Return Capital form states
  const [returnAmount, setReturnAmount] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]!);
  const [returnNotes, setReturnNotes] = useState("");

  // Sync initialData
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Deep linking trigger via ?funderId=...
  useEffect(() => {
    const funderIdParam = searchParams.get("funderId");
    if (funderIdParam && fundersList.length > 0) {
      router.push(`/capital-management/${funderIdParam}`);
    }
  }, [searchParams, fundersList, router]);

  const resetFunderForm = () => {
    setName("");
    setMobile("");
    setAddress("");
    setNotes("");
  };

  // Funders Tab Filtering Logics
  const filteredFunders = fundersList.filter((funder) => {
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

  // Handle Add Capital Person
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) {
      toast.error("Name and Mobile are required.");
      return;
    }

    startTransition(async () => {
      const res = await createFunderAction({
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        notes: notes.trim() || null,
        fundingModel: "on_demand",
      });

      if (res.success && res.data) {
        toast.success(res.message || "Capital person registered successfully!");
        setAddOpen(false);
        resetFunderForm();

        // Optimistic local update — new person appears instantly
        const newFunder: FunderWithReturns = {
          funderId:                   res.data.funderId,
          name:                       (res.data as any).name ?? name.trim(),
          mobile:                     (res.data as any).mobile ?? mobile.trim(),
          address:                    "",
          fundingModel:               "on_demand",
          capitalAmount:              0,
          investmentDate:             new Date().toISOString().split("T")[0]!,
          status:                     ((res.data as any).status ?? "active") as any,
          notes:                      (res.data as any).notes ?? null,
          createdAt:                  new Date().toISOString(),
          updatedAt:                  new Date().toISOString(),
          totalProvided:              0,
          currentlyAllocated:         0,
          returnedFromBorrower:       0,
          paidBackToCapitalPerson:    0,
          capitalPayable:             0,
          unallocatedReceived:        0,
          totalReturned:              0,
          remainingCapital:           0,
          availableCapital:           0,
          investmentIndex:            (data?.funders?.length ?? 0) + 1,
          totalFunderInvestments:     0,
          totalFunderCapitalProvided: 0,
          fundingHistory:             [],
          loansFunded:                [],
          returnsList:                [],
        };
        setData((prev) => ({
          ...prev,
          funders: [...(prev?.funders ?? []), newFunder],
          stats: { ...prev.stats, activeFunders: (prev?.stats?.activeFunders ?? 0) + 1 },
        }));
        // Background sync with server truth
        queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      } else if (res.success) {
        toast.success(res.message || "Capital person registered successfully!");
        setAddOpen(false);
        resetFunderForm();
        queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      } else {
        toast.error(res.error || "Failed to register capital person.");
      }
    });
  };

  // Handle Record Received Capital (Optimistic Mutation)
  const handleRecordReceivedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivedFunderId || !receivedAmount || Number(receivedAmount) <= 0) {
      toast.error("Please select a capital person and enter a valid received amount.");
      return;
    }

    const numAmt = Number(receivedAmount);
    const targetFunderId = receivedFunderId;

    await queryClient.cancelQueries({ queryKey: ["capital-management-data-v2"] });
    const previousCapital = queryClient.getQueryData<any>(["capital-management-data-v2"]);

    // Instant optimistic update in TanStack Query cache
    queryClient.setQueryData<any>(["capital-management-data-v2"], (old: any) => {
      if (!old || !old.funders) return old;
      return {
        ...old,
        funders: old.funders.map((f: any) => {
          if (f.funderId !== targetFunderId) return f;
          return {
            ...f,
            totalProvided: (Number(f.totalProvided) || 0) + numAmt,
            unallocatedReceived: (Number(f.unallocatedReceived) || 0) + numAmt,
          };
        }),
      };
    });

    setRecordReceivedOpen(false);
    setReceivedAmount("");
    setReceivedNotes("");

    startTransition(async () => {
      const res = await recordReceivedCapitalAction({
        funderId: targetFunderId,
        amount: numAmt,
        fundingDate: receivedDate,
        notes: receivedNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Capital received transaction ${res.data?.transactionCode} recorded!`);
        queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      } else {
        if (previousCapital) {
          queryClient.setQueryData(["capital-management-data-v2"], previousCapital);
        }
        toast.error(typeof res.error === "string" ? res.error : "Failed to record received capital.");
      }
    });
  };

  // Handle Edit Capital Person
  const handleEditOpen = (funder: FunderWithReturns, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFunder(funder);
    setName(funder.name);
    setMobile(funder.mobile);
    setAddress(funder.address);
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
    fd.append("notes", notes);

    startTransition(async () => {
      const res = await updateFunderAction(null, fd);
      if (res.success) {
        toast.success("Capital person profile updated successfully!");
        setEditOpen(false);
        // Instant local update — no page reload
        setData((prev) => ({
          ...prev,
          funders: (prev?.funders ?? []).map((f) =>
            f.funderId === selectedFunder.funderId
              ? { ...f, name: name.trim(), mobile: mobile.trim(), address: address.trim(), notes: notes.trim() || null }
              : f
          ),
        }));
        queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      } else {
        toast.error(res.error || "Failed to update capital person profile.");
      }
    });
  };

  // Handle Delete Funder
  const handleDeleteFunder = async (funderId: string, funderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${funderName}? All connected records will be removed.`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteFunderAction(funderId);
      if (res.success) {
        toast.success(`${funderName} removed.`);
        // Remove from local state immediately
        setData((prev) => ({
          ...prev,
          funders: (prev?.funders ?? []).filter((f) => f.funderId !== funderId),
          stats: { ...prev.stats, activeFunders: Math.max(0, (prev?.stats?.activeFunders ?? 1) - 1) },
        }));
        queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      } else {
        toast.error(res.error || "Failed to delete funder.");
      }
    });
  };

  // Handle Pay Capital Person
  const handleReturnOpen = (funder: FunderWithReturns, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFunder(funder);
    setReturnAmount(funder.capitalPayable > 0 ? funder.capitalPayable.toString() : "");
    setReturnDate(new Date().toISOString().split("T")[0]!);
    setReturnNotes("");
    setReturnOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunder) return;

    const numAmount = Number(returnAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (numAmount > selectedFunder.capitalPayable) {
      toast.error(`Maximum payable amount is ₹${fmt(selectedFunder.capitalPayable)}. Overpayment is not allowed.`);
      return;
    }

    startTransition(async () => {
      const res = await recordCapitalReturnAction({
        funderId: selectedFunder.funderId,
        amount: numAmount,
        returnDate,
        notes: returnNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Paid ₹${fmt(numAmount)} back to ${selectedFunder.name}! (${res.data?.paymentCode || "CP-001"})`);
        setReturnOpen(false);
        queryClient.invalidateQueries({ queryKey: ["capital-management-data-v2"] });
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to record payment.");
      }
    });
  };

  const handleViewDetails = (funder: FunderWithReturns) => {
    router.push(`/capital-management/${funder.funderId}`);
  };

  return (
    <div className="space-y-6">
      {/* ── TOP STATS CARDS GRID (CAPITAL PRINCIPAL TRACKING) ────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {/* Total Capital Provided */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-primary/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Provided</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-foreground tracking-tight">
              ₹{fmt(stats.totalProvided)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Total capital funded</p>
          </div>
        </div>

        {/* Currently Allocated in Loans */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-emerald-500/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Currently Allocated</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-emerald-500 tracking-tight">
              ₹{fmt(stats.currentlyAllocated)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Active with borrowers</p>
          </div>
        </div>

        {/* Unallocated Capital */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-blue-500/20 bg-blue-500/5 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Unallocated</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-blue-400 tracking-tight">
              ₹{fmt(stats.unallocatedReceived)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Available to deploy</p>
          </div>
        </div>

        {/* Returned From Borrowers */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-blue-500/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Returned (Borrower)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-blue-400 tracking-tight">
              ₹{fmt(stats.returnedFromBorrower)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Borrower principal repaid</p>
          </div>
        </div>

        {/* Paid Back to Capital Persons */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-purple-500/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Paid Back to Persons</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-purple-400 tracking-tight">
              ₹{fmt(stats.paidBackToCapitalPerson)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Returned to funders</p>
          </div>
        </div>

        {/* Capital Still Payable */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-primary/30 bg-primary/5 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-primary uppercase tracking-wider">Capital Payable</span>
            <div className="p-2 rounded-xl bg-primary/20 text-primary">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-primary tracking-tight">
              ₹{fmt(stats.capitalPayable)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Ready to pay back</p>
          </div>
        </div>
      </div>

      {/* ── CONTROLS & ACTIONS BAR ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-card/80 p-1.5 rounded-2xl border border-border/50 shadow-inner">
          <button
            onClick={() => setActiveTab("funders")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 fx-pressable ${
              activeTab === "funders"
                ? "fx-brand-gradient text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            }`}
          >
            Capital Persons ({fundersList.length})
          </button>
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 fx-pressable ${
              activeTab === "overview"
                ? "fx-brand-gradient text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            }`}
          >
            All Funding Events
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (data.funders.length > 0 && !receivedFunderId) {
                setReceivedFunderId(data.funders[0]!.funderId);
              }
              setRecordReceivedOpen(true);
            }}
            className="h-10 px-3.5 rounded-xl text-xs font-bold border-border/60 hover:bg-accent/30"
          >
            <ArrowDownRight className="h-4 w-4 mr-1 text-emerald-400" />
            Record Received Capital
          </Button>

          <Button
            onClick={() => {
              resetFunderForm();
              setAddOpen(true);
            }}
            className="h-10 px-4 rounded-xl text-xs font-bold fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable shadow-md"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Capital Person
          </Button>
        </div>
      </div>

      {/* ── TAB 1: CAPITAL PERSONS LIST ────────────────────────────────────── */}
      {activeTab === "funders" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by capital person name or mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-card border-border/50 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 px-3.5 rounded-xl bg-card border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredFunders.length === 0 ? (
            <div className="py-12 text-center bg-card/40 rounded-2xl border border-border/40 text-xs text-muted-foreground space-y-2">
              <Users className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
              <p className="font-semibold text-foreground text-sm">No capital persons found.</p>
              <p>Add a capital person as an on-demand funding contact.</p>
              <Button
                onClick={() => {
                  resetFunderForm();
                  setAddOpen(true);
                }}
                size="sm"
                className="mt-2 fx-brand-gradient text-white text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add First Capital Person
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFunders.map((funder) => (
                <div
                  key={funder.funderId}
                  onClick={() => handleViewDetails(funder)}
                  className="fx-glass-card rounded-[22px] p-5 border border-border/60 bg-card/60 hover:bg-card/90 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 fx-3d-hover"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                          {funder.name}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" /> {funder.mobile}
                        </p>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        funder.status === "settled" || (funder.currentlyAllocated === 0 && funder.capitalPayable === 0 && funder.totalProvided > 0)
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : funder.capitalPayable > 0
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}>
                        {funder.status === "settled" || (funder.currentlyAllocated === 0 && funder.capitalPayable === 0 && funder.totalProvided > 0)
                          ? "CAPITAL SETTLED"
                          : funder.capitalPayable > 0
                          ? "PARTIALLY RETURNED"
                          : "ACTIVE"}
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-accent/20 dark:bg-secondary/20 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Provided</span>
                        <p className="font-extrabold text-foreground text-sm mt-0.5">₹{fmt(funder.totalProvided)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Allocated</span>
                        <p className="font-extrabold text-emerald-400 text-sm mt-0.5">₹{fmt(funder.currentlyAllocated)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-blue-400">Unallocated</span>
                        <p className="font-extrabold text-blue-400 text-sm mt-0.5">₹{fmt(funder.unallocatedReceived)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Returned (Borrower)</span>
                        <p className="font-extrabold text-blue-400 text-sm mt-0.5">₹{fmt(funder.returnedFromBorrower)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Paid Back</span>
                        <p className="font-extrabold text-purple-400 text-sm mt-0.5">₹{fmt(funder.paidBackToCapitalPerson)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Loans</span>
                        <p className="font-extrabold text-foreground text-sm mt-0.5">{(funder.loansFunded || []).length}</p>
                      </div>
                      <div className="col-span-3 bg-primary/10 rounded-lg p-2 border border-primary/20 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-black text-primary block">Payable to Person</span>
                          <span className="font-black text-primary text-base">₹{fmt(funder.capitalPayable)}</span>
                        </div>
                        {funder.capitalPayable > 0 ? (
                          <Button
                            size="sm"
                            onClick={(e) => handleReturnOpen(funder, e)}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-black fx-brand-gradient text-white shadow-sm"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Pay Capital Person
                          </Button>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 rounded bg-muted/40">
                            Nothing to Pay
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Recent Funding Events Preview */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                        <span>Funding History ({(funder.fundingHistory || []).length})</span>
                      </p>

                      {(!funder.fundingHistory || funder.fundingHistory.length === 0) ? (
                        <p className="text-[11px] text-muted-foreground italic py-1">
                          No funding events recorded yet. Ready to fund on-demand.
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                          {(funder.fundingHistory || []).slice(0, 3).map((item) => (
                            <div
                              key={item.transactionId}
                              className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-[11px]"
                            >
                              <div className="truncate pr-2">
                                <span className="font-semibold text-foreground">
                                  {item.borrowerName ? `→ ${item.borrowerName}` : "Received (Advance)"}
                                </span>
                                <span className="text-[10px] text-muted-foreground block">
                                  {item.fundingDate} • {item.transactionCode}
                                </span>
                              </div>
                              <div className="text-right shrink-0 flex items-center gap-1.5">
                                <strong className="text-primary font-bold">
                                  ₹{fmt(item.originalAmount || item.amount)}
                                </strong>
                                {item.loanId && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/loan-management?loanId=${item.loanId}`);
                                    }}
                                    className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                    title="View Loan"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/40 gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(funder);
                      }}
                      className="text-xs font-semibold text-primary hover:text-primary/80 p-0 h-8 flex items-center gap-1"
                    >
                      <History className="h-3.5 w-3.5" /> Full History & Details
                    </Button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEditOpen(funder, e)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                        title="Edit Profile"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteFunder(funder.funderId, funder.name, e)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete Profile"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: OVERVIEW & ALL FUNDING EVENTS ────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> All Capital Funding Transactions (Ledger)
            </h3>
            <p className="text-xs text-muted-foreground">
              Every on-demand funding event and allocation recorded across all capital persons.
            </p>

            <div className="overflow-x-auto border border-border/30 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">ID / Date</th>
                    <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Capital Person</th>
                    <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Amount</th>
                    <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Linked Loan / Borrower</th>
                    <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Status</th>
                    <th className="p-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {fundersList.flatMap((f) =>
                    (f.fundingHistory || []).map((item) => ({ ...item, funderName: f.name, funderMobile: f.mobile }))
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No funding events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    fundersList.flatMap((f) =>
                      (f.fundingHistory || []).map((item) => ({ ...item, funderName: f.name, funderMobile: f.mobile }))
                    ).map((item) => (
                      <tr key={item.transactionId} className="hover:bg-muted/10">
                        <td className="p-3">
                          <strong className="text-foreground">{item.transactionCode}</strong>
                          <span className="text-[10px] text-muted-foreground block">{item.fundingDate}</span>
                        </td>
                        <td className="p-3 font-semibold text-foreground">
                          {item.funderName}
                        </td>
                        <td className="p-3 font-black text-primary">
                          ₹{fmt(item.amount)}
                        </td>
                        <td className="p-3">
                          {item.borrowerName ? (
                            <div>
                              <strong className="text-foreground">{item.borrowerName}</strong>
                              <span className="text-[10px] text-muted-foreground block">
                                Loan: ₹{fmt(item.loanPrincipal)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-blue-400 font-semibold">Advance Received (Unallocated)</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {item.loanId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/loan-management?loanId=${item.loanId}`)}
                              className="h-7 text-[10px] font-bold"
                            >
                              <span>View Loan</span>
                              <ExternalLink className="h-2.5 w-2.5 ml-1" />
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">No loan link</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD CAPITAL PERSON (NO FAKE POOL BALANCE) ────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Capital Person
            </DialogTitle>
            <DialogDescription>
              Register a funding contact for on-demand capital. No permanent wallet balance required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name*</Label>
              <Input
                placeholder="e.g. X or Funder Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number*</Label>
              <Input
                type="tel"
                placeholder="10-digit phone number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address (Optional)</Label>
              <Input
                placeholder="City or locality"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-11 rounded-xl bg-transparent border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (Optional)</Label>
              <Textarea
                placeholder="Funding terms, availability notes, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl min-h-[70px] bg-transparent border-border"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                className="h-11 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 rounded-xl text-xs font-bold fx-brand-gradient text-white border-0 fx-cta-glow px-5"
              >
                {isPending ? "Registering..." : "Add Capital Person"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: RECORD RECEIVED CAPITAL ──────────────────────────────────── */}
      <Dialog open={recordReceivedOpen} onOpenChange={setRecordReceivedOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-emerald-400" />
              Record Received Capital
            </DialogTitle>
            <DialogDescription>
              Record capital actually received from a funder before loan allocation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordReceivedSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Capital Person*</Label>
              <select
                value={receivedFunderId}
                onChange={(e) => setReceivedFunderId(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Choose Capital Person --</option>
                {data.funders.map((f) => (
                  <option key={f.funderId} value={f.funderId}>
                    {f.name} ({f.mobile})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Received Amount (₹)*</Label>
                <Input
                  type="number"
                  placeholder="e.g. 10000"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-transparent border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date Received*</Label>
                <Input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-transparent border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (Optional)</Label>
              <Input
                placeholder="e.g. Cash transfer for emergency lending"
                value={receivedNotes}
                onChange={(e) => setReceivedNotes(e.target.value)}
                className="h-11 rounded-xl bg-transparent border-border"
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              This amount will appear under <strong>Unallocated Received</strong> and can be assigned to loans as needed.
            </p>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRecordReceivedOpen(false)}
                className="h-11 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 rounded-xl text-xs font-bold fx-brand-gradient text-white border-0 fx-cta-glow px-5"
              >
                {isPending ? "Recording..." : "Record Received"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: EDIT CAPITAL PERSON ──────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Edit Capital Person Profile</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name*</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number*</Label>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-11 rounded-xl bg-transparent border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl min-h-[70px] bg-transparent border-border"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="h-11 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 rounded-xl text-xs font-bold fx-brand-gradient text-white border-0 fx-cta-glow px-5"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: PAY CAPITAL PERSON ────────────────────────────────────────── */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" /> Pay Capital Person
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Return capital principal to {selectedFunder?.name}. Principal only — no interest.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Maximum Principal Available to Pay
              </span>
              <p className="text-2xl font-black text-primary">₹{fmt(selectedFunder?.capitalPayable)}</p>
              <p className="text-[10px] text-muted-foreground">
                Principal only. No interest, rent, or profit. Overpayment is prevented.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Capital Person</Label>
              <Input
                value={`${selectedFunder?.name || ""} (${selectedFunder?.mobile || ""})`}
                disabled
                className="h-11 rounded-xl bg-muted/40 text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Amount (₹)*</Label>
              <Input
                type="number"
                placeholder={`Max: ${selectedFunder?.capitalPayable || 0}`}
                value={returnAmount}
                onChange={(e) => setReturnAmount(e.target.value)}
                required
                min="1"
                max={selectedFunder?.capitalPayable || 0}
                step="any"
                className="h-11 rounded-xl bg-transparent border-border font-bold text-base"
              />
              {Number(returnAmount) > (selectedFunder?.capitalPayable || 0) && (
                <p className="text-[11px] text-destructive font-semibold">
                  Maximum payable amount is ₹{fmt(selectedFunder?.capitalPayable)}.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Date*</Label>
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (Optional)</Label>
              <Input
                placeholder="e.g. Returned borrower principal"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                className="h-11 rounded-xl bg-transparent border-border text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturnOpen(false)}
                className="h-11 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending ||
                  Number(returnAmount) <= 0 ||
                  Number(returnAmount) > (selectedFunder?.capitalPayable || 0)
                }
                className="h-11 rounded-xl text-xs font-bold fx-brand-gradient text-white border-0 fx-cta-glow px-5"
              >
                {isPending ? "Processing..." : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

