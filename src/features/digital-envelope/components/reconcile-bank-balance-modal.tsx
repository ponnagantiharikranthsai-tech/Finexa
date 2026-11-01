"use client";

import React, { useState, useEffect } from "react";
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
import { Scale, Landmark, Info } from "lucide-react";
import { toast } from "sonner";
import { reconcileBankBalanceAction } from "../actions/reconcile-bank-balance.action";

interface ReconcileBankBalanceModalProps {
  currentTotalAccount2Balance: number;
  totalEnvelopesAllocated: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const fmt = (val: number | string | undefined | null) =>
  (Number(val) || 0).toLocaleString("en-IN");

export function ReconcileBankBalanceModal({
  currentTotalAccount2Balance,
  totalEnvelopesAllocated,
  open,
  onOpenChange,
  onSuccess,
}: ReconcileBankBalanceModalProps) {
  const [bankBalance, setBankBalance] = useState(String(currentTotalAccount2Balance));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setBankBalance(String(currentTotalAccount2Balance));
    }
  }, [open, currentTotalAccount2Balance]);

  const numVal = Number(bankBalance) || 0;
  const computedUnallocated = Math.max(0, numVal - totalEnvelopesAllocated);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numVal) || numVal < 0) {
      toast.error("Please enter a valid bank balance.");
      return;
    }

    if (numVal < totalEnvelopesAllocated) {
      toast.error(
        `Bank balance cannot be less than the total allocated envelopes (₹${fmt(totalEnvelopesAllocated)}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await reconcileBankBalanceAction({ newBankBalance: numVal });
      if (res.success) {
        toast.success(res.message || "Account 2 bank balance reconciled successfully!");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || "Failed to update balance.");
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
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Scale className="h-4 w-4 stroke-[2.5]" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Reconcile Account 2 Bank Balance
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Synchronize Finexa with your actual bank statement balance to compute Unallocated Cash.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Bank balance input */}
          <div className="space-y-1.5">
            <Label htmlFor="bank-bal" className="text-xs font-bold">
              Account 2 Bank Statement Balance (₹) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                id="bank-bal"
                type="number"
                step="any"
                min={totalEnvelopesAllocated}
                placeholder="0.00"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
                className="pl-8 text-lg font-bold h-11 rounded-xl"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Allocation preview card */}
          <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/50 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Total Tagged in Envelopes:</span>
              <span className="font-bold text-foreground">₹{fmt(totalEnvelopesAllocated)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                Resulting Unallocated Cash:
              </span>
              <span className="font-black text-sm text-blue-600 dark:text-blue-400">
                ₹{fmt(computedUnallocated)}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              Unallocated cash is any money in your Account 2 bank statement that is waiting to be
              partitioned into an envelope.
            </span>
          </div>

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
              disabled={isSubmitting || isNaN(numVal)}
              className="px-5 py-2 text-xs font-bold fx-brand-gradient text-white rounded-xl fx-pressable shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <Landmark className="h-3.5 w-3.5" />
              {isSubmitting ? "Saving..." : "Update Balance"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

