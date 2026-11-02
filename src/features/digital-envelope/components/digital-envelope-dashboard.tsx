"use client";

import React, { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  Plus,
  RefreshCw,
  History,
  Search,
  Scale,
  CreditCard,
  PiggyBank,
  Users,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getEnvelopesAction } from "../actions/get-envelopes.action";
import { deleteEnvelopeAction } from "../actions/delete-envelope.action";
import { TopSummaryCards } from "./top-summary-cards";
import { EnvelopeSection } from "./envelope-section";
import { DigitalEnvelopeSkeleton } from "@/components/ui/skeleton";
import type {
  DigitalEnvelopeDashboardData,
  DigitalEnvelopeItem,
  EnvelopeType,
} from "../types";

// ── Lazy-loaded heavy modal dialogs (Bundle size & initial payload optimization)
const CreateEnvelopeModal = dynamic(
  () => import("./create-envelope-modal").then((m) => m.CreateEnvelopeModal),
  { ssr: false }
);
const AddMoneyModal = dynamic(
  () => import("./add-money-modal").then((m) => m.AddMoneyModal),
  { ssr: false }
);
const PayBillWithdrawModal = dynamic(
  () => import("./pay-bill-withdraw-modal").then((m) => m.PayBillWithdrawModal),
  { ssr: false }
);
const EditEnvelopeModal = dynamic(
  () => import("./edit-envelope-modal").then((m) => m.EditEnvelopeModal),
  { ssr: false }
);
const ReconcileBankBalanceModal = dynamic(
  () => import("./reconcile-bank-balance-modal").then((m) => m.ReconcileBankBalanceModal),
  { ssr: false }
);
const MovementHistoryModal = dynamic(
  () => import("./movement-history-modal").then((m) => m.MovementHistoryModal),
  { ssr: false }
);

interface DigitalEnvelopeDashboardProps {
  initialData?: DigitalEnvelopeDashboardData;
}

const fmt = (val: number | string | undefined | null) =>
  (Number(val) || 0).toLocaleString("en-IN");

export function DigitalEnvelopeDashboard({ initialData }: DigitalEnvelopeDashboardProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  // 1. TanStack Query with Stale-While-Revalidate and client-side memory retention
  const { data, isLoading, isFetching, refetch } = useQuery<DigitalEnvelopeDashboardData>({
    queryKey: ["digital-envelopes-data"],
    queryFn: async () => {
      const res = await getEnvelopesAction();
      if (!res.success || !res.data) {
        throw new Error(res.error || "Failed to load digital envelopes.");
      }
      return res.data;
    },
    initialData,
    staleTime: 1000 * 60 * 5, // 5 mins fresh window
    gcTime: 1000 * 60 * 60 * 24, // 24 hours memory retention
    refetchOnWindowFocus: false,
  });

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "personal" | "third_party" | "history">("all");

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [createPresetType, setCreatePresetType] = useState<EnvelopeType>("personal");

  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [selectedEnvelopeForAdd, setSelectedEnvelopeForAdd] = useState<DigitalEnvelopeItem | null>(null);

  const [payBillOpen, setPayBillOpen] = useState(false);
  const [selectedEnvelopeForPay, setSelectedEnvelopeForPay] = useState<DigitalEnvelopeItem | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedEnvelopeForEdit, setSelectedEnvelopeForEdit] = useState<DigitalEnvelopeItem | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [filterEnvelopeForHistory, setFilterEnvelopeForHistory] = useState<DigitalEnvelopeItem | null>(null);

  const [reconcileOpen, setReconcileOpen] = useState(false);

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [envelopeToDelete, setEnvelopeToDelete] = useState<DigitalEnvelopeItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
    toast.success("Envelopes data refreshed!");
  };

  const handleOpenAddEnvelope = (type: EnvelopeType = "personal") => {
    setCreatePresetType(type);
    setCreateOpen(true);
  };

  const handleOpenAddMoney = (envelope: DigitalEnvelopeItem) => {
    setSelectedEnvelopeForAdd(envelope);
    setAddMoneyOpen(true);
  };

  const handleOpenPayBillWithdraw = (envelope: DigitalEnvelopeItem) => {
    setSelectedEnvelopeForPay(envelope);
    setPayBillOpen(true);
  };

  const handleOpenEdit = (envelope: DigitalEnvelopeItem) => {
    setSelectedEnvelopeForEdit(envelope);
    setEditOpen(true);
  };

  const handleOpenHistory = (envelope?: DigitalEnvelopeItem) => {
    setFilterEnvelopeForHistory(envelope || null);
    setHistoryOpen(true);
  };

  const handlePromptDelete = (envelope: DigitalEnvelopeItem) => {
    setEnvelopeToDelete(envelope);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!envelopeToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteEnvelopeAction({ envelopeId: envelopeToDelete.envelopeId });
      if (res.success) {
        toast.success(`Removed envelope "${envelopeToDelete.name}".`);
        setDeleteOpen(false);
        setEnvelopeToDelete(null);
        await queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
      } else {
        toast.error(res.error || "Failed to remove envelope.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !data) {
    return <DigitalEnvelopeSkeleton />;
  }

  const summary = data?.summary || {
    totalAccount2Balance: 0,
    myNetEnvelopes: 0,
    thirdPartyFunds: 0,
    unallocatedCash: 0,
    totalEnvelopesBalance: 0,
    personalEnvelopesCount: 0,
    thirdPartyEnvelopesCount: 0,
  };

  const personalEnvelopes = (data?.personalEnvelopes || []).filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q) ||
      e.notes?.toLowerCase().includes(q)
    );
  });

  const thirdPartyEnvelopes = (data?.thirdPartyEnvelopes || []).filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q) ||
      e.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                Digital Envelopes
              </h1>
              {isFetching && (
                <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold animate-pulse">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Syncing
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Account 2 bucket partitioning: Personal reserves, EMI, and third-party funds.
            </p>
          </div>
        </div>

        {/* Action Buttons: New Envelope, Movements History, Reconcile */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenHistory()}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-secondary hover:bg-accent/70 text-foreground text-xs font-bold transition-all border border-border/50 fx-pressable"
            title="View Audit Movement Logs"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Movement Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setReconcileOpen(true)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all border border-blue-500/20 fx-pressable"
            title="Reconcile Account 2 Bank Statement Balance"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Reconcile Cash</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddEnvelope("personal")}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl fx-brand-gradient text-white text-xs font-bold fx-cta-glow fx-pressable shadow-sm"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>New Envelope</span>
          </button>
        </div>
      </div>

      {/* ── Top Balance Summary Cards ──────────────────────────────── */}
      <TopSummaryCards
        summary={summary}
        onOpenReconcile={() => setReconcileOpen(true)}
      />

      {/* ── Controls: Search & Tabs Filter ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-xl w-full sm:w-auto border border-border/40">
          <button
            type="button"
            onClick={() => startTransition(() => setActiveTab("all"))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-card text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Buckets ({personalEnvelopes.length + thirdPartyEnvelopes.length})
          </button>
          <button
            type="button"
            onClick={() => startTransition(() => setActiveTab("personal"))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "personal"
                ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PiggyBank className="h-3.5 w-3.5" />
            <span>Personal ({personalEnvelopes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => startTransition(() => setActiveTab("third_party"))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "third_party"
                ? "bg-card text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Third-Party ({thirdPartyEnvelopes.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search envelopes or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9 rounded-xl bg-card/60"
          />
        </div>
      </div>

      {/* ── Envelopes Sections ───────────────────────────────────────── */}
      <div className="space-y-8 pt-1">
        {/* Section 1: Personal Envelopes */}
        {(activeTab === "all" || activeTab === "personal") && (
          <EnvelopeSection
            title="Personal Envelopes"
            type="personal"
            description="Dedicated personal buckets for loan EMI payments, savings, and investments."
            envelopes={personalEnvelopes}
            totalBalance={summary.myNetEnvelopes}
            onAddEnvelope={() => handleOpenAddEnvelope("personal")}
            onAddMoney={handleOpenAddMoney}
            onPayBillWithdraw={handleOpenPayBillWithdraw}
            onEdit={handleOpenEdit}
            onDelete={handlePromptDelete}
            onViewHistory={handleOpenHistory}
          />
        )}

        {/* Section 2: Third-Party Envelopes */}
        {(activeTab === "all" || activeTab === "third_party") && (
          <EnvelopeSection
            title="Third-Party Envelopes"
            type="third_party"
            description="External funds held on behalf of friends, partners, or temporary custodians."
            envelopes={thirdPartyEnvelopes}
            totalBalance={summary.thirdPartyFunds}
            onAddEnvelope={() => handleOpenAddEnvelope("third_party")}
            onAddMoney={handleOpenAddMoney}
            onPayBillWithdraw={handleOpenPayBillWithdraw}
            onEdit={handleOpenEdit}
            onDelete={handlePromptDelete}
            onViewHistory={handleOpenHistory}
          />
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {/* 1. Create Envelope Modal */}
      <CreateEnvelopeModal
        unallocatedCash={summary.unallocatedCash}
        existingEnvelopes={[...(data?.personalEnvelopes || []), ...(data?.thirdPartyEnvelopes || [])]}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] })}
      />

      {/* 2. Add Money Modal */}
      <AddMoneyModal
        envelope={selectedEnvelopeForAdd}
        unallocatedCash={summary.unallocatedCash}
        open={addMoneyOpen}
        onOpenChange={setAddMoneyOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] })}
      />

      {/* 3. Pay Bill / Withdraw Modal */}
      <PayBillWithdrawModal
        envelope={selectedEnvelopeForPay}
        open={payBillOpen}
        onOpenChange={setPayBillOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] })}
      />

      {/* 4. Edit Envelope Modal */}
      <EditEnvelopeModal
        envelope={selectedEnvelopeForEdit}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] })}
      />

      {/* 5. Movement History Audit Log Modal */}
      <MovementHistoryModal
        transactions={data?.recentTransactions || []}
        filterEnvelope={filterEnvelopeForHistory}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      {/* 6. Reconcile Bank Balance Modal */}
      <ReconcileBankBalanceModal
        currentTotalAccount2Balance={summary.totalAccount2Balance}
        totalEnvelopesAllocated={summary.totalEnvelopesBalance}
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] })}
      />

      {/* 7. Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl border border-border/50 p-6 text-center bg-card">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Delete Envelope?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{envelopeToDelete?.name}</strong>?
              {envelopeToDelete && envelopeToDelete.balance > 0 && (
                <span className="block mt-1 text-destructive font-semibold">
                  Warning: Current balance of ₹{fmt(envelopeToDelete.balance)} will be unallocated!
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-accent/40 rounded-xl transition-colors border border-border/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="px-5 py-2 text-xs font-bold bg-destructive hover:bg-destructive/90 text-white rounded-xl fx-pressable shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {isDeleting ? "Deleting..." : "Delete Envelope"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

