"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import type { LoanManagementDetailResult } from "../../actions/get-loan-management-data.action";

export interface ExtendLoanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanManagementDetailResult | null;
  onConfirm: () => void;
  isPending: boolean;
}

export function ExtendLoanModal({
  open,
  onOpenChange,
  loan,
  onConfirm,
  isPending,
}: ExtendLoanModalProps) {
  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight">Extend Due Period?</DialogTitle>
          <DialogDescription>
            Postpone this loan due date for another month.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2 text-sm text-foreground">
          <p><span className="text-muted-foreground">Current Due Date:</span> <strong>{loan.dueDate}</strong></p>
          <p>
            <span className="text-muted-foreground">Interest for Extension:</span>{" "}
            <strong className="text-primary">
              ₹{calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate)).toLocaleString("en-IN")}
            </strong>
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-border">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable font-bold">
            Confirm Extension
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
