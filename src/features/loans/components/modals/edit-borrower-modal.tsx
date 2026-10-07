"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LoanManagementDetailResult } from "../../actions/get-loan-management-data.action";

export interface EditBorrowerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanManagementDetailResult | null;
  borrowerName: string;
  setBorrowerName: (val: string) => void;
  borrowerMobile: string;
  setBorrowerMobile: (val: string) => void;
  borrowerEmail: string;
  setBorrowerEmail: (val: string) => void;
  borrowerPan: string;
  setBorrowerPan: (val: string) => void;
  borrowerAadhaar: string;
  setBorrowerAadhaar: (val: string) => void;
  borrowerLocation: string;
  setBorrowerLocation: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function EditBorrowerModal({
  open,
  onOpenChange,
  loan,
  borrowerName,
  setBorrowerName,
  borrowerMobile,
  setBorrowerMobile,
  borrowerEmail,
  setBorrowerEmail,
  borrowerPan,
  setBorrowerPan,
  borrowerAadhaar,
  setBorrowerAadhaar,
  borrowerLocation,
  setBorrowerLocation,
  onSubmit,
  isPending,
}: EditBorrowerModalProps) {
  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50 bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight">Edit Borrower Details</DialogTitle>
          <DialogDescription>
            Update KYC registration details for <strong>{loan.borrower.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name*</Label>
            <Input
              type="text"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              required
              className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number*</Label>
            <Input
              type="tel"
              value={borrowerMobile}
              onChange={(e) => setBorrowerMobile(e.target.value)}
              required
              className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address*</Label>
            <Input
              type="email"
              value={borrowerEmail}
              onChange={(e) => setBorrowerEmail(e.target.value)}
              required
              className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">PAN Card Number*</Label>
            <Input
              type="text"
              value={borrowerPan}
              onChange={(e) => setBorrowerPan(e.target.value.toUpperCase())}
              required
              className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aadhaar Card Number*</Label>
            <Input
              type="text"
              value={borrowerAadhaar}
              onChange={(e) => setBorrowerAadhaar(e.target.value)}
              required
              className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location URL (optional)</Label>
            <Input
              type="text"
              placeholder="Google Maps link"
              value={borrowerLocation}
              onChange={(e) => setBorrowerLocation(e.target.value)}
              className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-border">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable font-bold">
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
