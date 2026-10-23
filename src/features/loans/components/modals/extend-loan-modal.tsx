"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { calculateDueDate, calculateCustomDueDate } from "@/domain/due-date-calculator";
import { Calendar, ArrowRight, Clock, Sparkles } from "lucide-react";
import { format } from "date-fns";
import {
  triggerExtensionReceiptSuccess,
  downloadExtensionPdf,
  viewExtensionPdf,
} from "../../utils/generate-loan-extension-pdf";

export { triggerExtensionReceiptSuccess, downloadExtensionPdf, viewExtensionPdf };

export interface ExtendLoanDurationParams {
  months: number;
  days?: number;
}

export interface ExtendLoanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: {
    loanId: string;
    dueDate: string;
    principal: string | number;
    interestRate: string | number;
    interestType?: string;
    borrower?: { name: string; mobile?: string };
    monthlyInterestAmount?: number;
  } | null;
  onConfirm: (duration: ExtendLoanDurationParams) => void | Promise<any>;
  isPending: boolean;
}

export function ExtendLoanModal({
  open,
  onOpenChange,
  loan,
  onConfirm,
  isPending,
}: ExtendLoanModalProps) {
  const [durationKey, setDurationKey] = useState<string>("1");
  const [customDays, setCustomDays] = useState<string>("45");

  // Calculate base rates & values
  const calculations = useMemo(() => {
    if (!loan) return null;

    const principalNum = Number(loan.principal || 0);
    const rateNum = Number(loan.interestRate || 0);
    const singleMonthInterest =
      loan.monthlyInterestAmount ||
      calculateMonthlyInterest(principalNum, rateNum);

    const baseDueDate = new Date(loan.dueDate);

    let newDueDateObj: Date;
    let accruedInterest = 0;
    let durationLabel = "";
    let finalMonths = 1;
    let finalDays: number | undefined = undefined;

    if (durationKey === "custom_days") {
      const daysCount = Math.max(1, parseInt(customDays, 10) || 30);
      newDueDateObj = calculateCustomDueDate(baseDueDate, daysCount);
      accruedInterest = Math.round(singleMonthInterest * (daysCount / 30));
      durationLabel = `+${daysCount} Days`;
      finalMonths = Math.max(1, Math.round(daysCount / 30));
      finalDays = daysCount;
    } else {
      const months = Math.max(1, parseInt(durationKey, 10) || 1);
      newDueDateObj = calculateDueDate(baseDueDate, (loan.interestType as any) || "monthly", months);
      accruedInterest = Math.round(singleMonthInterest * months);
      durationLabel = `+${months} ${months === 1 ? "Month" : "Months"}`;
      finalMonths = months;
    }

    const newDueDateStr = isNaN(newDueDateObj.getTime())
      ? loan.dueDate
      : format(newDueDateObj, "yyyy-MM-dd");

    return {
      singleMonthInterest,
      accruedInterest,
      newDueDateStr,
      durationLabel,
      finalMonths,
      finalDays,
      principalNum,
    };
  }, [loan, durationKey, customDays]);

  if (!loan || !calculations) return null;

  const handleConfirm = async () => {
    const res = await onConfirm({
      months: calculations.finalMonths,
      days: calculations.finalDays,
    });
    if (res && typeof res === "object") {
      const data = "data" in res && res.data ? res.data : "newDueDate" in res ? res : null;
      if (data) {
        await triggerExtensionReceiptSuccess(data);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/60 bg-card text-card-foreground shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight">
                Extend Loan Period
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Postpone the due date for <strong>{loan.borrower?.name || "this borrower"}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Duration Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" /> Extension Duration
            </label>
            <Select value={durationKey} onValueChange={(val) => { if (val) setDurationKey(val); }}>
              <SelectTrigger className="rounded-xl bg-background/80 border-border text-xs font-semibold h-10">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover text-xs font-medium">
                <SelectItem value="1">1 Month (+1 Cycle)</SelectItem>
                <SelectItem value="2">2 Months (+2 Cycles)</SelectItem>
                <SelectItem value="3">3 Months (Quarterly Extension)</SelectItem>
                <SelectItem value="6">6 Months (Half-Year Extension)</SelectItem>
                <SelectItem value="custom_days">Custom Number of Days</SelectItem>
              </SelectContent>
            </Select>

            {durationKey === "custom_days" && (
              <div className="pt-2">
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Enter Custom Days
                </label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="e.g. 45"
                  className="rounded-xl text-xs h-9"
                />
              </div>
            )}
          </div>

          {/* Dynamic Comparison / Recalculation Card */}
          <div className="bg-secondary/40 border border-border/80 rounded-xl p-3.5 space-y-2.5 text-xs">
            {/* Timeline preview */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-background/70 border border-border/40">
              <div>
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Current Due Date
                </span>
                <span className="font-semibold text-foreground">{loan.dueDate}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="text-right">
                <span className="text-[10px] text-amber-500 block font-bold uppercase tracking-wider">
                  New Due Date ({calculations.durationLabel})
                </span>
                <span className="font-extrabold text-amber-400 flex items-center justify-end gap-1">
                  <Calendar className="h-3 w-3" />
                  {calculations.newDueDateStr}
                </span>
              </div>
            </div>

            {/* Financial breakdown */}
            <div className="space-y-1.5 pt-1 border-t border-border/40 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Principal Balance (unchanged):</span>
                <span className="font-mono font-semibold text-foreground">
                  ₹{calculations.principalNum.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Monthly Interest Rate:</span>
                <span className="font-mono font-semibold text-foreground">
                  ₹{calculations.singleMonthInterest.toLocaleString("en-IN")} / mo
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-border/30">
                <span className="font-bold text-foreground">Accrued Interest for Extension:</span>
                <span className="font-mono font-black text-primary text-sm">
                  ₹{calculations.accruedInterest.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-border text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable font-bold text-xs"
          >
            {isPending ? "Extending..." : `Confirm Extension (${calculations.durationLabel})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
