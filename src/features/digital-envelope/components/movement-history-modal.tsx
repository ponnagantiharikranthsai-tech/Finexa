"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { History, Plus, CreditCard, ArrowDownRight, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DigitalEnvelopeTransactionItem, DigitalEnvelopeItem } from "../types";

interface MovementHistoryModalProps {
  transactions: DigitalEnvelopeTransactionItem[];
  filterEnvelope?: DigitalEnvelopeItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmt = (val: number | string | undefined | null) =>
  (Number(val) || 0).toLocaleString("en-IN");

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export function MovementHistoryModal({
  transactions,
  filterEnvelope,
  open,
  onOpenChange,
}: MovementHistoryModalProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = transactions.filter((tx) => {
    if (filterEnvelope && tx.envelopeId !== filterEnvelope.envelopeId) {
      return false;
    }
    if (typeFilter !== "all" && tx.transactionType !== typeFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = tx.envelopeName?.toLowerCase().includes(q);
      const matchDesc = tx.description?.toLowerCase().includes(q);
      const matchRef = tx.referenceParty?.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchRef) return false;
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] rounded-2xl border border-border/50 bg-card p-6 max-h-[85vh] flex flex-col">
        <DialogHeader className="space-y-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <History className="h-4 w-4 stroke-[2.5]" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              {filterEnvelope ? `${filterEnvelope.name} — Audit History` : "Digital Envelopes Audit History"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete movement records showing balance changes, deposits, and bill deductions.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-2 pt-2 shrink-0">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search description, payee, or envelope..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-9 rounded-xl"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border/60 bg-secondary/60 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Movements</option>
            <option value="deposit">Deposits (+)</option>
            <option value="pay_bill">Bills Paid (💳)</option>
            <option value="withdrawal">Withdrawals (-)</option>
          </select>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No movement records found.
            </div>
          ) : (
            filtered.map((tx) => {
              const isDeposit = tx.transactionType === "deposit";
              const isBill = tx.transactionType === "pay_bill";

              return (
                <div
                  key={tx.transactionId}
                  className="p-3 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isDeposit
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : isBill
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {isDeposit ? (
                        <Plus className="h-4 w-4 stroke-[3]" />
                      ) : isBill ? (
                        <CreditCard className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate">
                          {tx.envelopeName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-semibold">
                          {tx.transactionType === "deposit"
                            ? "Deposit"
                            : tx.transactionType === "pay_bill"
                            ? "Bill Payment"
                            : "Withdrawal"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {tx.description || "Envelope balance adjustment"}
                        {tx.referenceParty && ` • Payee: ${tx.referenceParty}`}
                      </p>
                      <span className="text-[10px] text-muted-foreground/70 block mt-0.5">
                        {formatDate(tx.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-black text-sm block tracking-tight ${
                        isDeposit
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {isDeposit ? "+" : "-"}₹{fmt(tx.amount)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                      ₹{fmt(tx.balanceBefore)} → ₹{fmt(tx.balanceAfter)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

