"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { calculateAccruedPenalty } from "@/domain/penalty-calculator";
import { calculateDueDate } from "@/domain/due-date-calculator";
import type { LoanManagementDetailResult } from "../../actions/get-loan-management-data.action";

export interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanManagementDetailResult | null;
  paymentActionMode: "record" | "pay_extend" | "overdue_penalty" | "partial";
  setPaymentActionMode: (mode: "record" | "pay_extend" | "overdue_penalty" | "partial") => void;
  paymentAmount: string;
  setPaymentAmount: (val: string) => void;
  paymentType: "interest" | "principal" | "penalty";
  setPaymentType: (val: "interest" | "principal" | "penalty") => void;
  paymentDate: string;
  setPaymentDate: (val: string) => void;
  paymentNotes: string;
  setPaymentNotes: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function RecordPaymentModal({
  open,
  onOpenChange,
  loan,
  paymentActionMode,
  setPaymentActionMode,
  paymentAmount,
  setPaymentAmount,
  paymentType,
  setPaymentType,
  paymentDate,
  setPaymentDate,
  paymentNotes,
  setPaymentNotes,
  onSubmit,
  isPending,
}: RecordPaymentModalProps) {
  if (!loan) return null;

  const principalNum = Number(loan.principal || 0);
  const rateNum = Number(loan.interestRate || 0);
  const monthlyInterest = calculateMonthlyInterest(principalNum, rateNum);
  const currentDueDateObj = new Date(loan.dueDate);
  const isLoanOverdue = currentDueDateObj < new Date() || loan.status === "overdue";

  const penaltyRes = calculateAccruedPenalty({
    principal: principalNum,
    dueDate: loan.dueDate,
    status: loan.status,
    penaltyRate: Number((loan as any).penaltyRate || 50),
    manualPenaltyAmount: Number(loan.penaltyAmount || 0),
  });
  const penaltyAmt = Math.round(penaltyRes.totalPenalty);
  const overdueTotal = monthlyInterest + penaltyAmt;

  const currentCycleMonth = currentDueDateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const nextDueDateObj = calculateDueDate(currentDueDateObj);
  const nextCycleMonth = nextDueDateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const clearanceDateObj = paymentDate ? new Date(paymentDate) : new Date();
  const newCycleStartStr = clearanceDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg fx-glass-card border-border/50 bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight flex items-center justify-between">
            <span>Record Repayment & Cycle Actions</span>
            <span className="text-xs font-semibold text-muted-foreground">{loan.borrower.name}</span>
          </DialogTitle>
          <DialogDescription>
            Select payment action, verify cycle parameters, and confirm transaction for <strong>{loan.borrower.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-4">
            {/* Action Selection Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-accent/20 border border-border/40 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => { setPaymentActionMode("record"); setPaymentType("interest"); }}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  paymentActionMode === "record" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                💰 Record
              </button>
              <button
                type="button"
                onClick={() => { setPaymentActionMode("pay_extend"); }}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  paymentActionMode === "pay_extend" ? "bg-amber-600 text-white shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🔄 Pay & Extend
              </button>
              <button
                type="button"
                onClick={() => { setPaymentActionMode("overdue_penalty"); }}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  paymentActionMode === "overdue_penalty"
                    ? "bg-red-600 text-white shadow"
                    : isLoanOverdue
                    ? "text-red-400 font-extrabold hover:text-red-300"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚠️ Overdue
              </button>
              <button
                type="button"
                onClick={() => { setPaymentActionMode("partial"); setPaymentType("principal"); }}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  paymentActionMode === "partial" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                💳 Partial
              </button>
            </div>

            {/* MODE SPECIFIC FORMS */}
            {paymentActionMode === "pay_extend" ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-xs">
                <div className="flex items-center justify-between font-bold border-b border-amber-500/20 pb-2">
                  <span className="text-amber-400 font-extrabold flex items-center gap-1.5">
                    <RefreshCw className="h-4 w-4 animate-spin" /> PAY & EXTEND CONFIRMATION
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full uppercase">1 Cycle Extension</span>
                </div>
                <div className="space-y-1.5 text-foreground">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Interest:</span>
                    <span className="font-bold text-amber-300">₹{monthlyInterest.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Principal Outstanding:</span>
                    <span className="font-bold text-foreground">₹{principalNum.toLocaleString("en-IN")} (Remains 100%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Amount:</span>
                    <span className="font-extrabold text-emerald-400 text-sm">₹{monthlyInterest.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-500/20 pt-1.5 text-[11px]">
                    <span className="text-muted-foreground">Current Cycle:</span>
                    <span className="font-semibold text-foreground">{currentCycleMonth}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Next Cycle:</span>
                    <span className="font-extrabold text-primary">{nextCycleMonth}</span>
                  </div>
                </div>
              </div>
            ) : paymentActionMode === "overdue_penalty" ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3 text-xs">
                <div className="flex items-center justify-between font-bold border-b border-red-500/20 pb-2">
                  <span className="text-red-400 font-extrabold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> OVERDUE & PENALTY SETTLEMENT
                  </span>
                  <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full uppercase">{penaltyRes.daysOverdue} Days Overdue</span>
                </div>
                <div className="space-y-1.5 text-foreground">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Due Date:</span>
                    <span className="font-semibold text-foreground">{loan.dueDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Date:</span>
                    <span className="font-semibold text-foreground">{paymentDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest Amount:</span>
                    <span className="font-semibold text-foreground">₹{monthlyInterest.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Accrued Penalty:</span>
                    <span className="font-bold text-red-400">₹{penaltyAmt.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between border-t border-red-500/20 pt-1.5 font-bold">
                    <span className="text-foreground">Total Required Payment:</span>
                    <span className="text-sm font-black text-red-400">₹{overdueTotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-[11px] border-t border-red-500/20 pt-1 text-emerald-400 font-semibold">
                    <span>New Cycle Start Date:</span>
                    <span>{newCycleStartStr}</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹)*</Label>
                  <Input
                    type="number"
                    placeholder={paymentActionMode === "partial" ? "e.g. 2000 (Partial)" : "₹1000"}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required={paymentActionMode === "record" || paymentActionMode === "partial"}
                    className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Type / Allocation*</Label>
                  <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                    <SelectTrigger className="h-11 rounded-xl bg-transparent border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-white dark:bg-card">
                      <SelectItem value="interest">Interest Payment</SelectItem>
                      <SelectItem value="principal">Principal Reduction</SelectItem>
                      <SelectItem value="penalty">Late Penalty Settlement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Common Payment Date Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Actual Payment Date*</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>

            {/* Common Notes Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes / Transaction Reference</Label>
              <Textarea
                placeholder="e.g. UPI Ref Number, Cash receipt, GPay..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="rounded-xl bg-transparent border-border"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-border">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className={`rounded-xl border-0 text-white fx-pressable font-bold ${
                  paymentActionMode === "overdue_penalty"
                    ? "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30"
                    : paymentActionMode === "pay_extend"
                    ? "bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30"
                    : "fx-brand-gradient fx-cta-glow"
                }`}
              >
                {isPending
                  ? "Processing..."
                  : paymentActionMode === "pay_extend"
                  ? "Confirm Pay & Extend"
                  : paymentActionMode === "overdue_penalty"
                  ? "Confirm Overdue & Penalty Payment"
                  : "Record Payment"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
