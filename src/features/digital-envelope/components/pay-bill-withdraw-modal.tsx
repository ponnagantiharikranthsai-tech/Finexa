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
import { CreditCard, ArrowDownRight, AlertCircle, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { payBillWithdrawAction } from "../actions/pay-bill-withdraw.action";
import type { DigitalEnvelopeItem } from "../types";

interface PayBillWithdrawModalProps {
  envelope: DigitalEnvelopeItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const fmt = (val: number | string | undefined | null) =>
  (Number(val) || 0).toLocaleString("en-IN");

export function PayBillWithdrawModal({
  envelope,
  open,
  onOpenChange,
  onSuccess,
}: PayBillWithdrawModalProps) {
  const [isBillPayment, setIsBillPayment] = useState(true);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [referenceParty, setReferenceParty] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!envelope) return null;

  const currentBalance = envelope.balance;
  const numAmount = Number(amount) || 0;
  const isOverdraft = numAmount > currentBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }

    if (isOverdraft) {
      toast.error(
        `Amount exceeds available envelope balance (Available: ₹${fmt(currentBalance)}).`
      );
      return;
    }

    if (!description.trim()) {
      toast.error(
        isBillPayment
          ? "Please specify the bill or service being paid."
          : "Please specify the withdrawal reason."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await payBillWithdrawAction({
        envelopeId: envelope.envelopeId,
        amount: numAmount,
        description: description.trim(),
        referenceParty: referenceParty.trim() || undefined,
        isBillPayment,
      });

      if (res.success) {
        toast.success(
          res.message ||
            `Successfully processed ₹${fmt(numAmount)} from ${envelope.name}.`
        );
        setAmount("");
        setDescription("");
        setReferenceParty("");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || "Failed to process withdrawal.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl border border-border/50 bg-card p-6">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
              <CreditCard className="h-4 w-4 stroke-[2.5]" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Pay Bill / Withdraw Money
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Deduct from <strong className="text-foreground">{envelope.name}</strong> • Available:{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              ₹{fmt(currentBalance)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Action Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/50 rounded-xl">
            <button
              type="button"
              onClick={() => setIsBillPayment(true)}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                isBillPayment
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>💳 Pay Bill / EMI</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBillPayment(false)}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                !isBillPayment
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
              <span>💸 Withdraw Cash</span>
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount" className="text-xs font-bold">
                Amount to Deduct (₹) *
              </Label>
              {currentBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(currentBalance))}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Max (₹{fmt(currentBalance)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                id="pay-amount"
                type="number"
                step="any"
                min="1"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`pl-8 text-lg font-bold h-11 rounded-xl ${
                  isOverdraft ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                required
                autoFocus
              />
            </div>
            {isOverdraft && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Exceeds available balance of ₹{fmt(currentBalance)}
              </p>
            )}
          </div>

          {/* Bill or Purpose Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-desc" className="text-xs font-bold">
              {isBillPayment ? "Bill / Payment Purpose *" : "Withdrawal Purpose *"}
            </Label>
            <Input
              id="pay-desc"
              placeholder={
                isBillPayment
                  ? "e.g., HDFC Credit Card Bill, Loan EMI, Tata Power, Rent..."
                  : "e.g., Transferred back to Rahul, ATM withdrawal, Moved to primary account..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs rounded-xl h-10"
              required
            />
          </div>

          {/* Beneficiary / Party name (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref" className="text-xs font-bold">
              Payee / Beneficiary Name (Optional)
            </Label>
            <Input
              id="pay-ref"
              placeholder="e.g., HDFC Bank, Rahul Sharma, BESCOM..."
              value={referenceParty}
              onChange={(e) => setReferenceParty(e.target.value)}
              className="text-xs rounded-xl h-10"
            />
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
              disabled={isSubmitting || !numAmount || isOverdraft || !description.trim()}
              className="px-5 py-2 text-xs font-bold bg-destructive hover:bg-destructive/90 text-white rounded-xl fx-pressable shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <CreditCard className="h-3.5 w-3.5 stroke-[2.5]" />
              {isSubmitting ? "Processing..." : isBillPayment ? "Pay & Deduct" : "Withdraw & Deduct"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

