"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import type { LoanManagementDetailResult } from "../../actions/get-loan-management-data.action";

export interface SendReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanManagementDetailResult | null;
  penaltyAmount: string;
  setPenaltyAmount: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function SendReminderModal({
  open,
  onOpenChange,
  loan,
  penaltyAmount,
  setPenaltyAmount,
  onSubmit,
  isPending,
}: SendReminderModalProps) {
  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight">Send Repayment Reminder</DialogTitle>
          <DialogDescription>
            Dispatches an automated payment reminder alert to <strong>{loan.borrower.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Late Penalty Charge (₹, optional)</Label>
            <Input
              type="number"
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
            />
            <p className="text-[10px] text-muted-foreground">This amount will be applied to the loan penalty ledger balance.</p>
          </div>
          <div className="bg-accent/40 rounded-xl p-4 space-y-1.5 text-xs text-muted-foreground border border-border/30">
            <p className="font-bold text-foreground mb-1">Delivered via:</p>
            <p>📧 Email: {loan.borrower.email || "N/A"}</p>
            <p>💬 SMS Mobile: {loan.borrower.mobile}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-border">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white gap-2 fx-cta-glow fx-pressable font-bold">
              <Send className="h-4 w-4" /> Send Now
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
