"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Landmark,
  UserPlus,
  Coins,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  getFundersQuickListAction,
  type FunderQuickOption,
} from "@/features/capital/actions/get-funders-quick-list.action";
import { allocateCapitalAction } from "@/features/capital/actions/allocate-capital.action";
import { createFunderAction } from "@/features/capital/actions/create-funder.action";
import { LOANS_QUERY_KEY } from "../hooks/use-loan-management-data";
import type { LoanManagementDetailResult } from "../actions/get-loan-management-data.action";

interface AllocateCapitalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanManagementDetailResult | null;
  onSuccess?: () => void;
}

export function AllocateCapitalDialog({
  open,
  onOpenChange,
  loan,
  onSuccess,
}: AllocateCapitalDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [funders, setFunders] = useState<FunderQuickOption[]>([]);
  const [loadingFunders, setLoadingFunders] = useState(false);

  // Selected funder & form states
  const [selectedFunderId, setSelectedFunderId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [allocationDate, setAllocationDate] = useState<string>(
    new Date().toISOString().split("T")[0]!
  );
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline "Create New Capital Person" mode
  const [isCreatingFunder, setIsCreatingFunder] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCapitalAmount, setNewCapitalAmount] = useState("");
  const [newInvestmentDate, setNewInvestmentDate] = useState(
    new Date().toISOString().split("T")[0]!
  );
  const [newReturnDueDate, setNewReturnDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isCreatingPending, startCreateTransition] = useTransition();

  // Load funders whenever dialog opens
  useEffect(() => {
    if (open) {
      loadFunders();
      setIsCreatingFunder(false);
      if (loan) {
        setAllocationDate(loan.dateGiven || new Date().toISOString().split("T")[0]!);
        const remaining = loan.funding ? loan.funding.remainingRequired : Number(loan.principal);
        setAmount(remaining > 0 ? remaining.toString() : "");
      }
    }
  }, [open, loan]);

  const loadFunders = async () => {
    setLoadingFunders(true);
    const res = await getFundersQuickListAction();
    if (res.success && res.data) {
      setFunders(res.data);
      if (res.data.length > 0 && !selectedFunderId) {
        // Preselect funder with highest available capital
        const best = [...res.data].sort((a, b) => b.availableCapital - a.availableCapital)[0];
        if (best && best.availableCapital > 0) {
          setSelectedFunderId(best.funderId);
        }
      }
    } else {
      toast.error("Failed to load capital providers.");
    }
    setLoadingFunders(false);
  };

  const selectedFunder = funders.find((f) => f.funderId === selectedFunderId);

  // Loan metrics
  const loanPrincipal = loan ? Number(loan.principal) : 0;
  const alreadyFunded = loan?.funding ? loan.funding.totalFunded : 0;
  const remainingNeeded = Math.max(0, loanPrincipal - alreadyFunded);

  // Validation calculations
  const numAmount = Number(amount) || 0;
  const availableCap = selectedFunder ? selectedFunder.availableCapital : 0;
  const isOverFunderCap = selectedFunder ? numAmount > availableCap : false;
  const isOverLoanNeeded = numAmount > remainingNeeded;
  const isValidAmount = numAmount > 0 && !isOverFunderCap && !isOverLoanNeeded;

  // Handle Create Funder Inline
  const handleCreateNewFunder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newMobile.trim() || !newAddress.trim() || !newCapitalAmount) {
      toast.error("Please fill in all required capital provider details.");
      return;
    }

    startCreateTransition(async () => {
      const res = await createFunderAction({
        name: newName.trim(),
        mobile: newMobile.trim(),
        address: newAddress.trim(),
        capitalAmount: Number(newCapitalAmount),
        investmentDate: newInvestmentDate,
        returnDueDate: newReturnDueDate || newInvestmentDate,
        notes: newNotes.trim() || null,
      });

      if (res.success && res.data) {
        toast.success(`Capital provider "${newName}" registered successfully!`);
        // Reload funders & auto select
        await loadFunders();
        setSelectedFunderId(res.data.funderId);
        setIsCreatingFunder(false);
        // Pre-fill amount
        const prefill = Math.min(remainingNeeded, Number(newCapitalAmount));
        setAmount(prefill.toString());
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to register capital provider.");
      }
    });
  };

  // Handle Confirm Allocation
  const handleConfirmAllocation = async () => {
    if (!loan || !selectedFunderId || !isValidAmount) {
      toast.error("Please select a capital provider and enter a valid allocation amount.");
      return;
    }

    setIsSubmitting(true);
    const res = await allocateCapitalAction({
      loanId: loan.loanId,
      funderId: selectedFunderId,
      amount: numAmount,
      allocationDate,
      notes: notes.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(
        `Successfully allocated ₹${numAmount.toLocaleString("en-IN")} from ${selectedFunder?.name} to ${loan.borrower.name}!`
      );
      await queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to allocate capital.");
    }
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg fx-glass-card border-border/50 bg-white dark:bg-card p-6 text-left max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border/40 pb-4">
          <DialogTitle className="text-lg font-black tracking-tight flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              <span>Capital Allocation</span>
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Loan: ₹{loanPrincipal.toLocaleString("en-IN")}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Connect private capital person funds directly to {loan.borrower.name}&apos;s loan file.
          </DialogDescription>
        </DialogHeader>

        {/* ── Summary Banner ────────────────────────────────────────────────── */}
        <div className="p-3.5 rounded-xl bg-black/25 dark:bg-black/45 border border-border/40 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-semibold">Borrower:</span>
            <span className="font-extrabold text-foreground">{loan.borrower.name} ({loan.borrower.mobile})</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/20 text-center">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Principal</p>
              <p className="font-extrabold text-foreground mt-0.5">₹{loanPrincipal.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Already Funded</p>
              <p className="font-extrabold text-emerald-400 mt-0.5">₹{alreadyFunded.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Remaining Needed</p>
              <p className={`font-extrabold mt-0.5 ${remainingNeeded > 0 ? "text-amber-400 font-black" : "text-muted-foreground"}`}>
                ₹{remainingNeeded.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Existing Sources List (if any) ────────────────────────────────── */}
        {loan.funding && loan.funding.sources.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Current Capital Sources ({loan.funding.sources.length}):
            </p>
            <div className="space-y-1">
              {loan.funding.sources.map((s) => (
                <div
                  key={s.allocationId}
                  className="flex items-center justify-between p-2 rounded-lg bg-accent/20 dark:bg-secondary/15 border border-border/30 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{s.funderName}</span>
                    <span className="text-[10px] text-muted-foreground">({s.funderSharePercentage}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-primary">₹{s.amount.toLocaleString("en-IN")}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/capital-management?funderId=${s.funderId}`);
                      }}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 underline ml-1"
                      title="View in Capital Management"
                    >
                      <span>View</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Form: Select Funder or Create Inline ───────────────────────────── */}
        {!isCreatingFunder ? (
          <div className="space-y-4 pt-1">
            {/* Funder Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Select Capital Person / Funder *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingFunder(true)}
                  className="h-6 text-[11px] font-bold text-primary hover:text-primary/80 p-0 flex items-center gap-1"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>+ Add New Capital Person</span>
                </Button>
              </div>

              {loadingFunders ? (
                <div className="p-3 text-xs text-muted-foreground flex items-center gap-2 rounded-xl bg-accent/20">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading capital providers...
                </div>
              ) : funders.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-accent/20 border border-border/40 text-xs space-y-2">
                  <p className="text-muted-foreground">No capital providers registered yet.</p>
                  <Button
                    type="button"
                    onClick={() => setIsCreatingFunder(true)}
                    size="sm"
                    className="h-8 text-xs font-bold fx-brand-gradient text-white"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add First Capital Person
                  </Button>
                </div>
              ) : (
                <select
                  value={selectedFunderId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedFunderId(id);
                    const f = funders.find((x) => x.funderId === id);
                    if (f) {
                      const maxPossible = Math.min(remainingNeeded, f.availableCapital);
                      if (maxPossible > 0) setAmount(maxPossible.toString());
                    }
                  }}
                  className="w-full h-11 px-3.5 rounded-xl bg-accent/20 dark:bg-secondary/20 border border-border/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose a Capital Person --</option>
                  {funders.map((f) => (
                    <option key={f.funderId} value={f.funderId}>
                      {f.name} — Available: ₹{f.availableCapital.toLocaleString("en-IN")} (Total: ₹{f.totalCapital.toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Funder Balance Card */}
            {selectedFunder && (
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-primary" /> {selectedFunder.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{selectedFunder.mobile}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-primary/20 text-center">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground">Total Capital</span>
                    <p className="font-extrabold text-foreground mt-0.5">₹{selectedFunder.totalCapital.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground">Out with Borrowers</span>
                    <p className="font-extrabold text-amber-400 mt-0.5">₹{selectedFunder.capitalWithBorrowers.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground">Available Capital</span>
                    <p className="font-black text-emerald-400 mt-0.5">₹{selectedFunder.availableCapital.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Allocation Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Amount to Allocate (₹) *</Label>
                {selectedFunder && (
                  <button
                    type="button"
                    onClick={() => {
                      const maxFill = Math.min(remainingNeeded, selectedFunder.availableCapital);
                      setAmount(maxFill.toString());
                    }}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    Fill Max Available (₹{Math.min(remainingNeeded, selectedFunder.availableCapital).toLocaleString("en-IN")})
                  </button>
                )}
              </div>
              <Input
                type="number"
                placeholder="e.g. 10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`h-11 rounded-xl text-sm font-bold bg-accent/20 dark:bg-secondary/20 border-border/40 ${
                  isOverFunderCap || isOverLoanNeeded ? "border-red-500 focus-visible:ring-red-500" : ""
                }`}
              />

              {/* Validation helper text */}
              {isOverFunderCap ? (
                <p className="text-[11px] text-red-400 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Insufficient available capital! {selectedFunder?.name} only has ₹{availableCap.toLocaleString("en-IN")} available.
                </p>
              ) : isOverLoanNeeded ? (
                <p className="text-[11px] text-red-400 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Over-allocation! Maximum required to fully fund this loan is ₹{remainingNeeded.toLocaleString("en-IN")}.
                </p>
              ) : isValidAmount ? (
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  Valid allocation: Will fund {Math.round((numAmount / loanPrincipal) * 100)}% of this loan.
                </p>
              ) : null}
            </div>

            {/* Date & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Funding Date *</Label>
                <Input
                  type="date"
                  value={allocationDate}
                  onChange={(e) => setAllocationDate(e.target.value)}
                  className="h-11 rounded-xl text-xs bg-accent/20 dark:bg-secondary/20 border-border/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Internal Memo / Notes</Label>
                <Input
                  type="text"
                  placeholder="Optional reference memo"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-11 rounded-xl text-xs bg-accent/20 dark:bg-secondary/20 border-border/40"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-11 rounded-xl text-xs font-semibold px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!isValidAmount || isSubmitting}
                onClick={handleConfirmAllocation}
                className="h-11 rounded-xl text-xs font-black fx-brand-gradient text-white border-0 fx-cta-glow px-6 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Allocating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Confirm Allocation</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ── INLINE: Create New Capital Person Form ───────────────────────── */
          <form onSubmit={handleCreateNewFunder} className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-border/30">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" /> Register New Capital Person
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingFunder(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold"
              >
                ← Back to Selection
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Full Name *</Label>
                <Input
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-accent/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Mobile Number *</Label>
                <Input
                  required
                  placeholder="10-digit mobile"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-accent/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Address *</Label>
              <Input
                required
                placeholder="Residential / Office address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="h-10 rounded-xl text-xs bg-accent/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Capital Provided (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="e.g. 50000"
                  value={newCapitalAmount}
                  onChange={(e) => setNewCapitalAmount(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold bg-accent/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Investment Date *</Label>
                <Input
                  required
                  type="date"
                  value={newInvestmentDate}
                  onChange={(e) => setNewInvestmentDate(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-accent/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Return Due Date</Label>
                <Input
                  type="date"
                  value={newReturnDueDate}
                  onChange={(e) => setNewReturnDueDate(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-accent/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Notes</Label>
              <Input
                placeholder="Optional notes or repayment terms"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="h-10 rounded-xl text-xs bg-accent/20"
              />
            </div>

            <DialogFooter className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreatingFunder(false)}
                className="h-10 rounded-xl text-xs font-semibold px-4"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isCreatingPending}
                className="h-10 rounded-xl text-xs font-bold fx-brand-gradient text-white border-0 px-5"
              >
                {isCreatingPending ? "Creating..." : "Save & Select Capital Person"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
