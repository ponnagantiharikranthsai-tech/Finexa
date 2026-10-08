"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { createLoanAction } from "@/features/loans/actions/create-loan.action";
import { LOANS_QUERY_KEY } from "@/features/loans/hooks/use-loan-management-data";
import Link from "next/link";

export interface CreateLoanModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function CreateLoanModal({
  isOpen,
  open,
  onClose,
  onOpenChange,
}: CreateLoanModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isDialogOpen = isOpen ?? open ?? false;

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  const [borrowerName, setBorrowerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [principal, setPrincipal] = useState("10000");
  const [interestRate, setInterestRate] = useState("20");
  const [interestType, setInterestType] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [dateGiven, setDateGiven] = useState(new Date().toISOString().split("T")[0]!);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerName.trim()) {
      toast.error("Borrower name is required.");
      return;
    }
    if (!mobile.trim() || mobile.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    const numPrincipal = Number(principal);
    if (isNaN(numPrincipal) || numPrincipal <= 0) {
      toast.error("Please enter a valid loan amount.");
      return;
    }

    const fd = new FormData();
    fd.append("borrowerName", borrowerName.trim());
    fd.append("mobile", mobile.trim());
    fd.append("email", `${borrowerName.toLowerCase().replace(/\s+/g, "") || "borrower"}@example.com`);
    fd.append("pan", "ABCDE1234F"); // default placeholder for quick dispatch
    fd.append("aadhaar", "123456789012"); // default placeholder for quick dispatch
    fd.append("principal", principal);
    fd.append("interestRate", interestRate);
    fd.append("interestType", interestType);
    fd.append("dateGiven", dateGiven);

    startTransition(async () => {
      try {
        const res = await createLoanAction(null, fd);
        if (res.success) {
          toast.success(`Loan of ₹${Number(principal).toLocaleString("en-IN")} created for ${borrowerName}!`);
          queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
          handleClose();
          router.push("/loan-management");
        } else {
          const err = typeof res.error === "string" ? res.error : Object.values(res.error || {}).flat().join(", ");
          toast.error(err || "Failed to create loan");
        }
      } catch (err: any) {
        toast.error(err.message || "An unexpected error occurred while creating loan.");
      }
    });
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="rounded-2xl max-w-lg fx-glass-card border-border/50 bg-[#18181b] text-zinc-100 p-6 shadow-2xl z-50">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2 text-zinc-100">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <span>Quick Loan Creation</span>
            </DialogTitle>
            <Link
              href="/loans/new"
              onClick={handleClose}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors"
            >
              <span>Full Underwriting</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <DialogDescription className="text-xs text-zinc-400 mt-1">
            Instantly issue a loan or launch the advanced underwriting workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300">Borrower Full Name</Label>
              <Input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                className="bg-[#27272a] border-zinc-700/60 text-zinc-100 placeholder-zinc-500 rounded-xl text-xs h-9"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300">Mobile Number</Label>
              <Input
                type="tel"
                placeholder="10-digit number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="bg-[#27272a] border-zinc-700/60 text-zinc-100 placeholder-zinc-500 rounded-xl text-xs h-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300">Principal (₹)</Label>
              <Input
                type="number"
                min="500"
                step="500"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="bg-[#27272a] border-zinc-700/60 text-zinc-100 placeholder-zinc-500 rounded-xl text-xs h-9 font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300">Rate (%)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="bg-[#27272a] border-zinc-700/60 text-zinc-100 placeholder-zinc-500 rounded-xl text-xs h-9 font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300">Type</Label>
              <select
                value={interestType}
                onChange={(e) => setInterestType(e.target.value as any)}
                className="w-full bg-[#27272a] border border-zinc-700/60 text-zinc-100 rounded-xl text-xs h-9 px-3 outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-300">Date Disbursed</Label>
            <Input
              type="date"
              value={dateGiven}
              onChange={(e) => setDateGiven(e.target.value)}
              className="bg-[#27272a] border-zinc-700/60 text-zinc-100 placeholder-zinc-500 rounded-xl text-xs h-9"
            />
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="rounded-xl border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-[#eab308] text-black hover:bg-yellow-400 font-bold text-xs gap-1.5 px-4"
            >
              {isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating Loan...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Loan</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
