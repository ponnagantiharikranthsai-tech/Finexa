"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Landmark, Plus, ExternalLink, RefreshCw } from "lucide-react";
import { getFundersQuickListAction, type FunderQuickOption } from "@/features/capital/actions/get-funders-quick-list.action";
import { recordReceivedCapitalAction } from "@/features/capital/actions/record-received-capital.action";
import Link from "next/link";

export interface CapitalFundingModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function CapitalFundingModal({
  isOpen,
  open,
  onClose,
  onOpenChange,
}: CapitalFundingModalProps) {
  const router = useRouter();
  const isDialogOpen = isOpen ?? open ?? false;

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  const [funders, setFunders] = useState<FunderQuickOption[]>([]);
  const [selectedFunderId, setSelectedFunderId] = useState("");
  const [amount, setAmount] = useState("50000");
  const [fundingDate, setFundingDate] = useState(new Date().toISOString().split("T")[0]!);
  const [notes, setNotes] = useState("");
  const [isLoadingFunders, setIsLoadingFunders] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isDialogOpen) {
      setIsLoadingFunders(true);
      getFundersQuickListAction()
        .then((res) => {
          if (res.success && res.data) {
            setFunders(res.data);
            if (res.data.length > 0 && !selectedFunderId) {
              setSelectedFunderId(res.data[0].funderId);
            }
          }
        })
        .catch(() => {
          toast.error("Failed to load capital partners.");
        })
        .finally(() => {
          setIsLoadingFunders(false);
        });
    }
  }, [isDialogOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunderId) {
      toast.error("Please select a capital person.");
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await recordReceivedCapitalAction({
          funderId: selectedFunderId,
          amount: numAmount,
          fundingDate,
          notes: notes.trim() || undefined,
        });

        if (res.success) {
          toast.success(`Capital inflow of ₹${numAmount.toLocaleString("en-IN")} recorded successfully!`);
          handleClose();
          router.push("/capital-management");
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Failed to record capital inflow.");
        }
      } catch (err: any) {
        toast.error(err.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="rounded-2xl max-w-lg fx-glass-card border-border/50 bg-[#18181b] text-zinc-100 p-6 shadow-2xl z-50">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2 text-zinc-100">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Landmark className="h-4 w-4" />
              </div>
              <span>On-Demand Capital Inflow</span>
            </DialogTitle>
            <Link
              href="/capital-management"
              onClick={handleClose}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors"
            >
              <span>Full Ledger</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <DialogDescription className="text-xs text-zinc-400 mt-1">
            Record funds provided by a capital partner directly into your active pool.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-300">Capital Person / Investor</Label>
            {isLoadingFunders ? (
              <div className="h-9 w-full rounded-xl bg-[#27272a] animate-pulse flex items-center px-3 text-xs text-zinc-400">
                Loading capital partners...
              </div>
            ) : funders.length === 0 ? (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                No capital partners registered yet.{" "}
                <Link href="/capital-management" onClick={handleClose} className="underline font-bold">
                  Add one in Capital Management
                </Link>
              </div>
            ) : (
              <select
                value={selectedFunderId}
                onChange={(e) => setSelectedFunderId(e.target.value)}
                className="w-full bg-[#27272a] border border-zinc-700/60 text-zinc-100 rounded-xl text-xs h-9 px-3 outline-none"
                required
              >
                {funders.map((f) => (
                  <option key={f.funderId} value={f.funderId}>
                    {f.name} ({f.mobile})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300">Inflow Amount (₹)</Label>
              <Input
                type="number"
                min="1000"
                step="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-[#27272a] border-zinc-700/60 text-zinc-100 placeholder-zinc-500 rounded-xl text-xs h-9 font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300">Date Received</Label>
              <Input
                type="date"
                value={fundingDate}
                onChange={(e) => setFundingDate(e.target.value)}
                className="bg-[#27272a] border-zinc-700/60 text-zinc-100 placeholder-zinc-500 rounded-xl text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-300">Notes (Optional)</Label>
            <Input
              type="text"
              placeholder="e.g. Bank transfer, NEFT, cash advance..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              disabled={isPending || funders.length === 0}
              className="rounded-xl bg-[#eab308] text-black hover:bg-yellow-400 font-bold text-xs gap-1.5 px-4"
            >
              {isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Recording Inflow...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Record Capital</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
