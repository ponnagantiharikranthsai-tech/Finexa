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
  CreditCard, ExternalLink, ShieldCheck, UserPlus, History
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

export function CapitalManagementList({ initialData }: CapitalManagementListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<"funders" | "overview">("funders");

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
    if (funderIdParam && data.funders.length > 0) {
      const match = data.funders.find((f) => f.funderId === funderIdParam);
      if (match) {
        setActiveTab("funders");
        setSelectedFunder(match);
        setDetailsOpen(true);
      }
    }
  }, [searchParams, data.funders]);

  const resetFunderForm = () => {
    setName("");
    setMobile("");
    setAddress("");
    setNotes("");
  };

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

      if (res.success) {
        toast.success(res.message || "Capital person registered successfully!");
        setAddOpen(false);
        resetFunderForm();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to register capital person.");
      }
    });
  };

  // Handle Record Received Capital
  const handleRecordReceivedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivedFunderId || !receivedAmount || Number(receivedAmount) <= 0) {
      toast.error("Please select a capital person and enter a valid received amount.");
      return;
    }

    startTransition(async () => {
      const res = await recordReceivedCapitalAction({
        funderId: receivedFunderId,
        amount: Number(receivedAmount),
        fundingDate: receivedDate,
        notes: receivedNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Capital received transaction ${res.data?.transactionCode} recorded!`);
        setRecordReceivedOpen(false);
        setReceivedAmount("");
        setReceivedNotes("");
        router.refresh();
      } else {
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
        router.refresh();
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
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete funder.");
      }
    });
  };

  // Handle Return Capital
  const handleReturnOpen = (funder: FunderWithReturns, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFunder(funder);
    setReturnAmount(funder.remainingCapital > 0 ? funder.remainingCapital.toString() : "");
    setReturnDate(new Date().toISOString().split("T")[0]!);
    setReturnNotes("");
    setReturnOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunder) return;

    const numAmount = Number(returnAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid return amount.");
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
        toast.success(`Capital return of ₹${numAmount.toLocaleString("en-IN")} recorded!`);
        setReturnOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to record return.");
      }
    });
  };

  const handleViewDetails = (funder: FunderWithReturns) => {
    setSelectedFunder(funder);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ── TOP STATS CARDS GRID (ON-DEMAND CAPITAL MODEL) ───────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
              ₹{data.stats.totalProvided.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Sum of actual funding transactions</p>
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
              ₹{data.stats.currentlyAllocated.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Active capital funded to borrowers</p>
          </div>
        </div>

        {/* Unallocated Received Capital */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-blue-500/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Unallocated Received</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-blue-400 tracking-tight">
              ₹{data.stats.unallocatedReceived.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Money received & pending assignment</p>
          </div>
        </div>

        {/* Active Capital Persons */}
        <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-amber-500/20 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-2 fx-3d-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Capital Persons</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-amber-500 tracking-tight">
              {data.stats.activeFunders}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">On-demand funding sources</p>
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
            Capital Persons ({data.funders.length})
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

                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                        On-Demand
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-accent/20 dark:bg-secondary/20 text-center">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Total Provided</span>
                        <p className="font-extrabold text-foreground text-sm mt-0.5">
                          ₹{funder.totalProvided.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Allocated</span>
                        <p className="font-extrabold text-emerald-400 text-sm mt-0.5">
                          ₹{funder.currentlyAllocated.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Unallocated</span>
                        <p className="font-extrabold text-blue-400 text-sm mt-0.5">
                          ₹{funder.unallocatedReceived.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    {/* Recent Funding Events Preview */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                        <span>Funding History ({funder.fundingHistory.length})</span>
                      </p>

                      {funder.fundingHistory.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic py-1">
                          No funding events recorded yet. Ready to fund on-demand.
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                          {funder.fundingHistory.slice(0, 3).map((item) => (
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
                                  ₹{item.amount.toLocaleString("en-IN")}
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
                  {data.funders.flatMap((f) =>
                    f.fundingHistory.map((item) => ({ ...item, funderName: f.name, funderMobile: f.mobile }))
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No funding events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    data.funders.flatMap((f) =>
                      f.fundingHistory.map((item) => ({ ...item, funderName: f.name, funderMobile: f.mobile }))
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
                          ₹{item.amount.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3">
                          {item.borrowerName ? (
                            <div>
                              <strong className="text-foreground">{item.borrowerName}</strong>
                              <span className="text-[10px] text-muted-foreground block">
                                Loan: ₹{item.loanPrincipal?.toLocaleString("en-IN")}
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

      {/* ── MODAL: VIEW DETAILS & FUNDING HISTORY ──────────────────────────── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="rounded-2xl max-w-3xl max-h-[85vh] overflow-y-auto fx-glass-card border-border/50 bg-white dark:bg-card p-6 text-left">
          {selectedFunder && (
            <div className="space-y-6">
              <DialogHeader className="border-b border-border/40 pb-4">
                <DialogTitle className="text-xl font-black tracking-tight flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <span>{selectedFunder.name} — Funding File</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    On-Demand Funding
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Verified on-demand funding history and loan connections.
                </DialogDescription>
              </DialogHeader>

              {/* Personal Info & Financial Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-accent/20 dark:bg-secondary/20 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Mobile</span>
                  <p className="font-extrabold text-foreground text-sm mt-0.5">{selectedFunder.mobile}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Provided</span>
                  <p className="font-extrabold text-foreground text-sm mt-0.5">
                    ₹{selectedFunder.totalProvided.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Currently Allocated</span>
                  <p className="font-extrabold text-emerald-400 text-sm mt-0.5">
                    ₹{selectedFunder.currentlyAllocated.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Unallocated Received</span>
                  <p className="font-extrabold text-blue-400 text-sm mt-0.5">
                    ₹{selectedFunder.unallocatedReceived.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* ── Section 15: Funding History ────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                    <History className="h-4 w-4" /> Funding History ({selectedFunder.fundingHistory.length})
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    Chronological record of individual funding events
                  </span>
                </div>

                {selectedFunder.fundingHistory.length === 0 ? (
                  <div className="py-8 text-center bg-accent/10 rounded-xl text-xs text-muted-foreground">
                    No funding events recorded yet for {selectedFunder.name}.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border/30 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/30 bg-muted/20">
                          <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Date</th>
                          <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Transaction</th>
                          <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Amount</th>
                          <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Borrower / Loan</th>
                          <th className="p-3 font-bold text-muted-foreground uppercase text-[10px]">Status</th>
                          <th className="p-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {selectedFunder.fundingHistory.map((item) => (
                          <tr key={item.transactionId} className="hover:bg-muted/10">
                            <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                              {item.fundingDate}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-muted-foreground">
                              {item.transactionCode}
                            </td>
                            <td className="p-3 font-black text-primary whitespace-nowrap">
                              ₹{item.amount.toLocaleString("en-IN")}
                            </td>
                            <td className="p-3">
                              {item.borrowerName ? (
                                <div>
                                  <strong className="text-foreground">{item.borrowerName}</strong>
                                  <span className="text-[10px] text-muted-foreground block">
                                    Loan ID: {item.loanId?.slice(0, 8)}...
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
                                  onClick={() => {
                                    setDetailsOpen(false);
                                    router.push(`/loan-management?loanId=${item.loanId}`);
                                  }}
                                  className="h-7 text-[10px] font-bold"
                                >
                                  <span>View Loan</span>
                                  <ExternalLink className="h-2.5 w-2.5 ml-1" />
                                </Button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">N/A</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Capital Returns (if any recorded) */}
              {selectedFunder.returnsList && selectedFunder.returnsList.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
                    <ArrowUpLeft className="h-4 w-4" /> Capital Returned to {selectedFunder.name}
                  </h3>
                  <div className="divide-y divide-border/20 border border-border/30 rounded-xl overflow-hidden">
                    {selectedFunder.returnsList.map((r) => (
                      <div key={r.returnId} className="p-3 flex items-center justify-between text-xs bg-muted/10">
                        <div>
                          <span className="font-bold text-foreground">₹{r.amount.toLocaleString("en-IN")}</span>
                          <span className="text-[10px] text-muted-foreground block">{r.returnDate}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{r.notes || "Capital repaid"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
