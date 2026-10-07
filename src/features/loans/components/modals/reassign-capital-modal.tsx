"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, RefreshCw } from "lucide-react";
import type { LoanManagementDetailResult } from "../../actions/get-loan-management-data.action";
import type { FunderQuickOption } from "@/features/capital/actions/get-funders-quick-list.action";

export interface ReassignCapitalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanManagementDetailResult | null;
  reassignAmount: number;
  reassignOldFunderName: string;
  reassignFunders: FunderQuickOption[];
  reassignSelectedFunderId: string | null;
  setReassignSelectedFunderId: (id: string) => void;
  reassignLoading: boolean;
  reassignSubmitting: boolean;
  onConfirm: () => void;
}

export function ReassignCapitalModal({
  open,
  onOpenChange,
  loan,
  reassignAmount,
  reassignOldFunderName,
  reassignFunders,
  reassignSelectedFunderId,
  setReassignSelectedFunderId,
  reassignLoading,
  reassignSubmitting,
  onConfirm,
}: ReassignCapitalModalProps) {
  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!reassignSubmitting) onOpenChange(o); }}>
      <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle className="text-base font-black tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Reassign Capital Source
          </DialogTitle>
          <DialogDescription className="text-xs">
            Switching capital source for <strong>{loan.borrower.name}</strong> — ₹{reassignAmount.toLocaleString("en-IN")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Current source */}
          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-xs">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Current Source</p>
            <p className="font-semibold text-foreground">{reassignOldFunderName}</p>
            <p className="text-muted-foreground mt-0.5">₹{reassignAmount.toLocaleString("en-IN")} — will be released</p>
          </div>

          {/* New source selector */}
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Select New Capital Person</label>
            {reassignLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading funders...
              </div>
            ) : reassignFunders.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 text-center">
                No other capital persons available.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {reassignFunders.map((f) => (
                  <button
                    key={f.funderId}
                    type="button"
                    onClick={() => setReassignSelectedFunderId(f.funderId)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                      reassignSelectedFunderId === f.funderId
                        ? "border-primary bg-primary/10 text-foreground shadow-sm"
                        : "border-border/50 bg-black/10 dark:bg-black/20 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-bold text-foreground">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{f.mobile}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-primary font-bold">₹{f.unallocatedReceived.toLocaleString("en-IN")} available</p>
                      <p className="text-[10px] text-muted-foreground">{f.unallocatedReceived >= reassignAmount ? "✓ Sufficient" : "On-demand"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary of what will happen */}
          {reassignSelectedFunderId && reassignFunders.length > 0 && (() => {
            const sel = reassignFunders.find((f) => f.funderId === reassignSelectedFunderId);
            return sel ? (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1">
                <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">New Assignment</p>
                <p className="font-semibold text-foreground">{sel.name} → ₹{reassignAmount.toLocaleString("en-IN")}</p>
                {sel.unallocatedReceived >= reassignAmount ? (
                  <p className="text-muted-foreground">Will use {sel.name}&apos;s existing unallocated capital.</p>
                ) : (
                  <p className="text-amber-400">On-demand: a new funding record will be created for {sel.name}.</p>
                )}
              </div>
            ) : null;
          })()}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reassignSubmitting}
            className="rounded-xl border-border"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={reassignSubmitting || !reassignSelectedFunderId}
            className="rounded-xl fx-brand-gradient border-0 text-white fx-pressable font-bold"
          >
            {reassignSubmitting ? "Reassigning..." : "Confirm Reassignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
