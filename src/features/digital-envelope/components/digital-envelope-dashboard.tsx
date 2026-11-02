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
  RotateCcw,
  Sparkles,
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
import { createEnvelopeAction } from "../actions/create-envelope.action";
import { addEnvelopeMoneyAction } from "../actions/add-envelope-money.action";
import { payBillWithdrawAction } from "../actions/pay-bill-withdraw.action";
import { reconcileBankBalanceAction } from "../actions/reconcile-bank-balance.action";
import { deleteEnvelopeAction } from "../actions/delete-envelope.action";
import { resetEnvelopesAction } from "../actions/reset-envelopes.action";
import { initializeCoreEnvelopesAction } from "../actions/initialize-core-envelopes.action";
import { TopSummaryCards } from "./top-summary-cards";
import { EnvelopeSection } from "./envelope-section";
import { DigitalEnvelopeSkeleton } from "@/components/ui/skeleton";
import type {
  DigitalEnvelopeDashboardData,
  DigitalEnvelopeItem,
  DigitalEnvelopeTransactionItem,
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

  // Reset confirmation
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isInitializingCores, setIsInitializingCores] = useState(false);

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

  // ─── ⚡ INSTANT OPTIMISTIC MUTATIONS (Zero-Lag WhatsApp/Instagram Speed) ─────

  // 1. Optimistic Add Money
  const handleOptimisticAddMoney = async (params: {
    envelopeId: string;
    amount: number;
    description?: string;
    fundSource: "external" | "unallocated_cash";
  }) => {
    const previous = queryClient.getQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"]);

    // Instant local state update
    queryClient.setQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"], (old) => {
      if (!old) return old;
      const target = [...old.personalEnvelopes, ...old.thirdPartyEnvelopes].find(
        (e) => e.envelopeId === params.envelopeId
      );
      if (!target) return old;

      const isPersonal = target.type === "personal";
      const updateList = (list: DigitalEnvelopeItem[]) =>
        list.map((e) =>
          e.envelopeId === params.envelopeId
            ? { ...e, balance: e.balance + params.amount, updatedAt: new Date().toISOString() }
            : e
        );

      const personalEnvelopes = isPersonal ? updateList(old.personalEnvelopes) : old.personalEnvelopes;
      const thirdPartyEnvelopes = !isPersonal ? updateList(old.thirdPartyEnvelopes) : old.thirdPartyEnvelopes;

      const myNet = personalEnvelopes.reduce((acc, e) => acc + e.balance, 0);
      const thirdParty = thirdPartyEnvelopes.reduce((acc, e) => acc + e.balance, 0);
      const totalEnvelopes = myNet + thirdParty;

      let newStatedBank = old.summary.totalAccount2Balance;
      if (params.fundSource === "external") {
        newStatedBank += params.amount;
      }
      if (newStatedBank < totalEnvelopes) {
        newStatedBank = totalEnvelopes;
      }
      const unallocated = Math.max(0, newStatedBank - totalEnvelopes);

      const optTx: DigitalEnvelopeTransactionItem = {
        transactionId: "opt-" + Date.now(),
        envelopeId: params.envelopeId,
        envelopeName: target.name,
        envelopeType: target.type,
        envelopeCategory: target.category || undefined,
        transactionType: "deposit",
        amount: params.amount,
        balanceBefore: target.balance,
        balanceAfter: target.balance + params.amount,
        description: params.description || `Added ₹${fmt(params.amount)} to ${target.name}`,
        createdAt: new Date().toISOString(),
      };

      return {
        ...old,
        summary: {
          ...old.summary,
          totalAccount2Balance: newStatedBank,
          myNetEnvelopes: myNet,
          thirdPartyFunds: thirdParty,
          unallocatedCash: unallocated,
          totalEnvelopesBalance: totalEnvelopes,
        },
        personalEnvelopes,
        thirdPartyEnvelopes,
        recentTransactions: [optTx, ...old.recentTransactions],
      };
    });

    try {
      const res = await addEnvelopeMoneyAction(params);
      if (!res.success) {
        if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
        toast.error(res.error || "Failed to add money. Changes rolled back.");
      } else {
        toast.success(res.message || "Money added successfully!");
        queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
      }
    } catch (err: any) {
      if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
      toast.error(err?.message || "Failed to add money. Rolled back.");
    }
  };

  // 2. Optimistic Pay Bill / Withdraw
  const handleOptimisticPayBillWithdraw = async (params: {
    envelopeId: string;
    amount: number;
    description: string;
    referenceParty?: string;
    isBillPayment: boolean;
  }) => {
    const previous = queryClient.getQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"]);

    // Instant local state update
    queryClient.setQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"], (old) => {
      if (!old) return old;
      const target = [...old.personalEnvelopes, ...old.thirdPartyEnvelopes].find(
        (e) => e.envelopeId === params.envelopeId
      );
      if (!target) return old;

      const isPersonal = target.type === "personal";
      const updateList = (list: DigitalEnvelopeItem[]) =>
        list.map((e) =>
          e.envelopeId === params.envelopeId
            ? { ...e, balance: Math.max(0, e.balance - params.amount), updatedAt: new Date().toISOString() }
            : e
        );

      const personalEnvelopes = isPersonal ? updateList(old.personalEnvelopes) : old.personalEnvelopes;
      const thirdPartyEnvelopes = !isPersonal ? updateList(old.thirdPartyEnvelopes) : old.thirdPartyEnvelopes;

      const myNet = personalEnvelopes.reduce((acc, e) => acc + e.balance, 0);
      const thirdParty = thirdPartyEnvelopes.reduce((acc, e) => acc + e.balance, 0);
      const totalEnvelopes = myNet + thirdParty;
      const newStatedBank = Math.max(totalEnvelopes, old.summary.totalAccount2Balance - params.amount);
      const unallocated = Math.max(0, newStatedBank - totalEnvelopes);

      const optTx: DigitalEnvelopeTransactionItem = {
        transactionId: "opt-" + Date.now(),
        envelopeId: params.envelopeId,
        envelopeName: target.name,
        envelopeType: target.type,
        envelopeCategory: target.category || undefined,
        transactionType: params.isBillPayment ? "pay_bill" : "withdrawal",
        amount: params.amount,
        balanceBefore: target.balance,
        balanceAfter: Math.max(0, target.balance - params.amount),
        description: params.description,
        referenceParty: params.referenceParty,
        createdAt: new Date().toISOString(),
      };

      return {
        ...old,
        summary: {
          ...old.summary,
          totalAccount2Balance: newStatedBank,
          myNetEnvelopes: myNet,
          thirdPartyFunds: thirdParty,
          unallocatedCash: unallocated,
          totalEnvelopesBalance: totalEnvelopes,
        },
        personalEnvelopes,
        thirdPartyEnvelopes,
        recentTransactions: [optTx, ...old.recentTransactions],
      };
    });

    try {
      const res = await payBillWithdrawAction(params);
      if (!res.success) {
        if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
        toast.error(res.error || "Payment failed. Changes rolled back.");
      } else {
        toast.success(res.message || "Processed successfully!");
        queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
      }
    } catch (err: any) {
      if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
      toast.error(err?.message || "Failed to process withdrawal. Rolled back.");
    }
  };

  // 3. Optimistic Create Envelope
  const handleOptimisticCreateEnvelope = async (params: {
    name: string;
    category: string;
    type: EnvelopeType;
    initialAmount: number;
    fundSource: "external" | "unallocated_cash";
    targetAmount?: number | null;
    color: string;
    notes?: string | null;
  }) => {
    const previous = queryClient.getQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"]);

    // Instant local state update
    const optId = "opt-env-" + Date.now();
    const newEnvelope: DigitalEnvelopeItem = {
      envelopeId: optId,
      name: params.name,
      category: params.category,
      type: params.type,
      balance: params.initialAmount,
      targetAmount: params.targetAmount || null,
      color: params.color,
      icon: params.type === "third_party" ? "user" : "wallet",
      notes: params.notes || null,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    queryClient.setQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"], (old) => {
      if (!old) return old;
      const isPersonal = params.type === "personal";
      const personalEnvelopes = isPersonal ? [...old.personalEnvelopes, newEnvelope] : old.personalEnvelopes;
      const thirdPartyEnvelopes = !isPersonal ? [...old.thirdPartyEnvelopes, newEnvelope] : old.thirdPartyEnvelopes;

      const myNet = personalEnvelopes.reduce((acc, e) => acc + e.balance, 0);
      const thirdParty = thirdPartyEnvelopes.reduce((acc, e) => acc + e.balance, 0);
      const totalEnvelopes = myNet + thirdParty;

      let newStatedBank = old.summary.totalAccount2Balance;
      if (params.fundSource === "external") {
        newStatedBank += params.initialAmount;
      }
      if (newStatedBank < totalEnvelopes) {
        newStatedBank = totalEnvelopes;
      }
      const unallocated = Math.max(0, newStatedBank - totalEnvelopes);

      const recentTransactions = [...old.recentTransactions];
      if (params.initialAmount > 0) {
        recentTransactions.unshift({
          transactionId: "opt-tx-" + Date.now(),
          envelopeId: optId,
          envelopeName: params.name,
          envelopeType: params.type,
          envelopeCategory: params.category,
          transactionType: "deposit",
          amount: params.initialAmount,
          balanceBefore: 0,
          balanceAfter: params.initialAmount,
          description: `Initial allocation for ${params.name}`,
          createdAt: new Date().toISOString(),
        });
      }

      return {
        ...old,
        summary: {
          totalAccount2Balance: newStatedBank,
          myNetEnvelopes: myNet,
          thirdPartyFunds: thirdParty,
          unallocatedCash: unallocated,
          totalEnvelopesBalance: totalEnvelopes,
          personalEnvelopesCount: personalEnvelopes.length,
          thirdPartyEnvelopesCount: thirdPartyEnvelopes.length,
        },
        personalEnvelopes,
        thirdPartyEnvelopes,
        recentTransactions,
      };
    });

    try {
      const res = await createEnvelopeAction(params);
      if (!res.success) {
        if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
        toast.error(res.error || "Failed to create envelope. Rolled back.");
      } else {
        toast.success(res.message || `Created envelope "${params.name}"!`);
        queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
      }
    } catch (err: any) {
      if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
      toast.error(err?.message || "Failed to create envelope. Rolled back.");
    }
  };

  // 4. Optimistic Delete Envelope
  const handleOptimisticDelete = async () => {
    if (!envelopeToDelete) return;
    const targetId = envelopeToDelete.envelopeId;
    const targetName = envelopeToDelete.name;
    const previous = queryClient.getQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"]);

    setDeleteOpen(false);
    setEnvelopeToDelete(null);

    // Instant local state update
    queryClient.setQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"], (old) => {
      if (!old) return old;
      const personalEnvelopes = old.personalEnvelopes.filter((e) => e.envelopeId !== targetId);
      const thirdPartyEnvelopes = old.thirdPartyEnvelopes.filter((e) => e.envelopeId !== targetId);

      const myNet = personalEnvelopes.reduce((acc, e) => acc + e.balance, 0);
      const thirdParty = thirdPartyEnvelopes.reduce((acc, e) => acc + e.balance, 0);
      const totalEnvelopes = myNet + thirdParty;
      const unallocated = Math.max(0, old.summary.totalAccount2Balance - totalEnvelopes);

      return {
        ...old,
        summary: {
          ...old.summary,
          myNetEnvelopes: myNet,
          thirdPartyFunds: thirdParty,
          unallocatedCash: unallocated,
          totalEnvelopesBalance: totalEnvelopes,
          personalEnvelopesCount: personalEnvelopes.length,
          thirdPartyEnvelopesCount: thirdPartyEnvelopes.length,
        },
        personalEnvelopes,
        thirdPartyEnvelopes,
      };
    });

    try {
      const res = await deleteEnvelopeAction({ envelopeId: targetId });
      if (!res.success) {
        if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
        toast.error(res.error || `Failed to remove "${targetName}". Rolled back.`);
      } else {
        toast.success(`Removed envelope "${targetName}".`);
        queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
      }
    } catch (err: any) {
      if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
      toast.error(err?.message || "Failed to delete envelope. Rolled back.");
    }
  };

  // 5. Optimistic Reconcile Bank Balance
  const handleOptimisticReconcile = async (newBankBalance: number) => {
    const previous = queryClient.getQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"]);

    // Instant local state update
    queryClient.setQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"], (old) => {
      if (!old) return old;
      const unallocated = Math.max(0, newBankBalance - old.summary.totalEnvelopesBalance);
      return {
        ...old,
        summary: {
          ...old.summary,
          totalAccount2Balance: newBankBalance,
          unallocatedCash: unallocated,
        },
      };
    });

    try {
      const res = await reconcileBankBalanceAction({ newBankBalance });
      if (!res.success) {
        if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
        toast.error(res.error || "Failed to reconcile balance. Rolled back.");
      } else {
        toast.success(res.message || "Bank balance reconciled!");
        queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
      }
    } catch (err: any) {
      if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
      toast.error(err?.message || "Failed to update balance. Rolled back.");
    }
  };

  // 6. Reset All Envelopes & Transaction History (Clean Fresh Zero State)
  const handleConfirmReset = async () => {
    setIsResetting(true);
    const previous = queryClient.getQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"]);

    // Instant zero-state reset
    queryClient.setQueryData<DigitalEnvelopeDashboardData>(["digital-envelopes-data"], {
      summary: {
        totalAccount2Balance: 0,
        myNetEnvelopes: 0,
        thirdPartyFunds: 0,
        unallocatedCash: 0,
        totalEnvelopesBalance: 0,
        personalEnvelopesCount: 0,
        thirdPartyEnvelopesCount: 0,
      },
      personalEnvelopes: [],
      thirdPartyEnvelopes: [],
      recentTransactions: [],
    });

    try {
      const res = await resetEnvelopesAction();
      if (res.success) {
        toast.success("All envelopes and audit records cleared! Fresh 0-state ready.");
        setResetOpen(false);
        queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
      } else {
        if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
        toast.error(res.error || "Failed to reset envelopes.");
      }
    } catch (err: any) {
      if (previous) queryClient.setQueryData(["digital-envelopes-data"], previous);
      toast.error(err?.message || "Failed to reset.");
    } finally {
      setIsResetting(false);
    }
  };

  // 7. Quick Setup: Initialize Core Envelopes at ₹0 (EMI, Savings, Investment)
  const handleInitializeCoreEnvelopes = async () => {
    setIsInitializingCores(true);
    try {
      const res = await initializeCoreEnvelopesAction();
      if (res.success) {
        toast.success("Initialized 3 core personal envelopes at ₹0 (EMI, Savings, Investments)!");
        await queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] });
      } else {
        toast.error(res.error || "Failed to initialize core envelopes.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to initialize.");
    } finally {
      setIsInitializingCores(false);
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

        {/* Action Buttons: Movements History, Reconcile, Reset Data, New Envelope */}
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
            onClick={() => setResetOpen(true)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold transition-all border border-destructive/20 fx-pressable"
            title="Clear all envelopes & reset database"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset Data</span>
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

      {/* ── Envelopes Sections or Zero State ────────────────────────── */}
      {personalEnvelopes.length === 0 && thirdPartyEnvelopes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 sm:p-12 text-center space-y-4 animate-in fade-in duration-200">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-inner">
            <Wallet className="h-8 w-8 stroke-[1.75]" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">Clean Zero State Ready</h2>
            <p className="text-xs text-muted-foreground">
              Your digital envelopes are completely fresh. You can create custom envelopes from scratch or initialize core personal envelopes at ₹0.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleOpenAddEnvelope("personal")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 h-10 px-5 rounded-xl fx-brand-gradient text-white text-xs font-bold shadow-md fx-cta-glow fx-pressable"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              Create Custom Envelope
            </button>
            <button
              type="button"
              disabled={isInitializingCores}
              onClick={handleInitializeCoreEnvelopes}
              className="w-full sm:w-auto flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-secondary hover:bg-accent/70 text-foreground text-xs font-bold border border-border/60 fx-pressable disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              {isInitializingCores ? "Setting up..." : "Initialize Core Envelopes (₹0)"}
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {/* 1. Create Envelope Modal */}
      <CreateEnvelopeModal
        unallocatedCash={summary.unallocatedCash}
        existingEnvelopes={[...(data?.personalEnvelopes || []), ...(data?.thirdPartyEnvelopes || [])]}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] })}
        onOptimisticSubmit={handleOptimisticCreateEnvelope}
        onOptimisticAddMoney={handleOptimisticAddMoney}
      />

      {/* 2. Add Money Modal */}
      <AddMoneyModal
        envelope={selectedEnvelopeForAdd}
        unallocatedCash={summary.unallocatedCash}
        open={addMoneyOpen}
        onOpenChange={setAddMoneyOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] })}
        onOptimisticSubmit={handleOptimisticAddMoney}
      />

      {/* 3. Pay Bill / Withdraw Modal */}
      <PayBillWithdrawModal
        envelope={selectedEnvelopeForPay}
        open={payBillOpen}
        onOpenChange={setPayBillOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["digital-envelopes-data"] })}
        onOptimisticSubmit={handleOptimisticPayBillWithdraw}
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
        onOptimisticSubmit={handleOptimisticReconcile}
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
              onClick={handleOptimisticDelete}
              className="px-5 py-2 text-xs font-bold bg-destructive hover:bg-destructive/90 text-white rounded-xl fx-pressable shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {isDeleting ? "Deleting..." : "Delete Envelope"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. Reset All Envelopes & Transaction Logs Confirmation Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border/50 p-6 text-center bg-card">
          <DialogHeader className="space-y-2">
            <div className="h-11 w-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <RotateCcw className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Reset Digital Envelopes?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will clear all envelope buckets, delete movement transaction audit logs, and reset Account 2 stated bank balance to ₹0.
              <span className="block mt-2 font-semibold text-destructive">
                This action is clean and permanent.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 flex flex-row items-center justify-end gap-2">
            <button
              type="button"
              disabled={isResetting}
              onClick={() => setResetOpen(false)}
              className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-accent/40 rounded-xl transition-colors border border-border/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isResetting}
              onClick={handleConfirmReset}
              className="px-5 py-2 text-xs font-bold bg-destructive hover:bg-destructive/90 text-white rounded-xl fx-pressable shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {isResetting ? "Resetting..." : "Confirm & Reset All"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

