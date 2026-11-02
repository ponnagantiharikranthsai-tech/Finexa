"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Coins, ArrowRight, Wallet } from "lucide-react";
import { toast } from "sonner";
import { addEnvelopeMoneyAction } from "../actions/add-envelope-money.action";
import type { DigitalEnvelopeItem } from "../types";

interface AddMoneyModalProps {
  envelope: DigitalEnvelopeItem | null;
  unallocatedCash: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onOptimisticSubmit?: (params: {
    envelopeId: string;
    amount: number;
    description?: string;
    fundSource: "external" | "unallocated_cash";
  }) => void;
}

const fmt = (val: number | string | undefined | null) =>
  (Number(val) || 0).toLocaleString("en-IN");

export function AddMoneyModal({
  envelope,
  unallocatedCash,
  open,
  onOpenChange,
  onSuccess,
  onOptimisticSubmit,
}: AddMoneyModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [fundSource, setFundSource] = useState<"external" | "unallocated_cash">("external");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!envelope) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }

    if (fundSource === "unallocated_cash" && numAmount > unallocatedCash) {
      toast.error(`Insufficient unallocated cash. Available: ₹${fmt(unallocatedCash)}`);
      return;
    }

    // Zero-lag instant optimistic UI update
    if (onOptimisticSubmit) {
      onOptimisticSubmit({
        envelopeId: envelope.envelopeId,
        amount: numAmount,
        description: description.trim() || undefined,
        fundSource,
      });
      setAmount("");
      setDescription("");
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addEnvelopeMoneyAction({
        envelopeId: envelope.envelopeId,
        amount: numAmount,
        description: description.trim() || undefined,
        fundSource,
      });

      if (res.success) {
        toast.success(res.message || `Added ₹${fmt(numAmount)} to ${envelope.name}!`);
        setAmount("");
        setDescription("");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || "Failed to add money.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl border border-border/50 bg-card p-6">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Plus className="h-4 w-4 stroke-[3]" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Add Money
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Fund <strong className="text-foreground">{envelope.name}</strong> (Current balance: ₹{fmt(envelope.balance)})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="add-amount" className="text-xs font-bold">
              Amount to Add (₹) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                id="add-amount"
                type="number"
                step="any"
                min="1"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 text-lg font-bold h-11 rounded-xl"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Funding Source selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Funding Source</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFundSource("external")}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  fundSource === "external"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">Direct Deposit</span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Adds to Account 2 balance
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFundSource("unallocated_cash")}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  fundSource === "unallocated_cash"
                    ? "border-blue-500 bg-blue-500/10 text-foreground"
                    : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-bold text-foreground">Unallocated Cash</span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Available: ₹{fmt(unallocatedCash)}
                </span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="add-notes" className="text-xs font-bold">
              Notes / Description (Optional)
            </Label>
            <Textarea
              id="add-notes"
              rows={2}
              placeholder="e.g., Monthly salary allocation, friend repayment, bonus..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs rounded-xl"
            />
          </div>

          {/* Live Cumulative Calculation Preview */}
          {Number(amount) > 0 && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs animate-in fade-in duration-150">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Balance Progression
                </span>
                <p className="font-semibold text-foreground">
                  ₹{fmt(envelope.balance)} + ₹{fmt(amount)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-primary uppercase font-bold tracking-wider">
                  New Total Balance
                </span>
                <p className="text-sm font-black text-primary">
                  ₹{fmt(envelope.balance + Number(amount))}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-accent/40 rounded-xl transition-colors border border-border/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className="px-5 py-2 text-xs font-bold fx-brand-gradient text-white rounded-xl fx-pressable shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              {isSubmitting ? "Adding..." : "Confirm & Deposit"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

