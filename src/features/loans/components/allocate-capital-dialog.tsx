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
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import {
  getFundersQuickListAction,
  type FunderQuickOption,
} from "@/features/capital/actions/get-funders-quick-list.action";
import { allocateCapitalAction } from "@/features/capital/actions/allocate-capital.action";
import { createFunderAction } from "@/features/capital/actions/create-funder.action";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  const [fundingStatus, setFundingStatus] = useState<"allocated" | "received" | "pending">("allocated");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline "Create New Capital Person" mode
  const [isCreatingFunder, setIsCreatingFunder] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
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
        setSelectedFunderId(res.data[0]!.funderId);
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

  // Validation calculations (On-Demand Model)
  const numAmount = Number(amount) || 0;
  const isOverLoanNeeded = numAmount > remainingNeeded;
  const isValidAmount = numAmount > 0 && !isOverLoanNeeded;

  // Handle Create Funder Inline (No fake balance required)
  const handleCreateNewFunder = async (e: React.FormEvent) => {
    e.preventDefault();
    const funderName = newName.trim();
    const funderPhone = newMobile.trim();
    const notes = newNotes.trim();

    if (!funderName || !funderPhone) {
      toast.error("Please enter capital person name and mobile number.");
      return;
    }

    startCreateTransition(async () => {
      let createdFunderId: string | null = null;
      let createdFunderName: string = funderName;

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('funders')
          .insert([
            {
              name: funderName.trim(),
              mobile: funderPhone.trim(),
              status: 'active',
              notes: notes.trim() || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          ])
          .select()
          .single();

        if (!error && data) {
          createdFunderId = data.funder_id;
          createdFunderName = data.name || funderName;
        }
      } catch (err) {
        // Fallback to server action
      }

      if (!createdFunderId) {
        const res = await createFunderAction({
          name: funderName,
          mobile: funderPhone,
          status: 'active',
          notes: notes || null,
          fundingModel: "on_demand",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (res.success && res.data) {
          createdFunderId = res.data.funderId;
          createdFunderName = res.data.name;
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Failed to register capital person.");
          return;
        }
      }

      toast.success(`Capital person "${createdFunderName}" registered successfully!`);
      await loadFunders();
      setSelectedFunderId(createdFunderId);
      setIsCreatingFunder(false);
      setNewName("");
      setNewMobile("");
      setNewNotes("");
      // Pre-fill amount with remaining loan needed
      if (remainingNeeded > 0) {
        setAmount(remainingNeeded.toString());
      }
    });
  };

  // Handle Confirm Allocation
  const handleConfirmAllocation = async () => {
    if (!loan || !selectedFunderId || !isValidAmount) {
      toast.error("Please select a capital person and enter a valid funding amount.");
      return;
    }

    setIsSubmitting(true);
    const res = await allocateCapitalAction({
      loanId: loan.loanId,
      funderId: selectedFunderId,
      amount: numAmount,
      allocationDate,
      status: fundingStatus,
      notes: notes.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(
        `Successfully linked ₹${numAmount.toLocaleString("en-IN")} from ${selectedFunder?.name} to ${loan.borrower.name}!`
      );

      // Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to record capital funding.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-xl fx-glass-card border-border/50 bg-white dark:bg-card p-6 text-left">
        <DialogHeader className="border-b border-border/40 pb-3">
          <DialogTitle className="text-lg font-black tracking-tight flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              <span>On-Demand Capital Funding</span>
            </span>
            {loan && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Loan Principal: ₹{Number(loan.principal).toLocaleString("en-IN")}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Connect an on-demand capital provider to fund this loan. Record the actual amount provided.
          </DialogDescription>
        </DialogHeader>

        {/* ── Summary of current loan funding status ────────────────────────── */}
        {loan && (
          <div className="p-3.5 rounded-xl bg-accent/20 dark:bg-secondary/20 border border-border/40 text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-muted-foreground">Borrower: <strong className="text-foreground">{loan.borrower.name}</strong></span>
              <span className="text-muted-foreground">Mobile: <strong className="text-foreground">{loan.borrower.mobile}</strong></span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Required</span>
                <p className="font-extrabold text-foreground mt-0.5">₹{loanPrincipal.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Funded</span>
                <p className="font-extrabold text-emerald-400 mt-0.5">₹{alreadyFunded.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Remaining Needed</span>
                <p className="font-extrabold text-amber-400 mt-0.5">₹{remainingNeeded.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Existing Sources on this Loan ─────────────────────────────────── */}
        {loan?.funding && loan.funding.sources.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Current Capital Sources on this Loan ({loan.funding.sources.length})
            </Label>
            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {loan.funding.sources.map((s) => (
                <div
                  key={s.allocationId}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/30 text-xs"
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
                  onChange={(e) => setSelectedFunderId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-accent/20 dark:bg-secondary/20 border border-border/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose a Capital Person --</option>
                  {funders.map((f) => (
                    <option key={f.funderId} value={f.funderId}>
                      {f.name} {f.unallocatedReceived > 0 ? `(Unallocated: ₹${f.unallocatedReceived.toLocaleString("en-IN")})` : `(On-Demand)`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Funder Profile Info & Unallocated Capital Card */}
            {selectedFunder && (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-primary" /> {selectedFunder.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{selectedFunder.mobile}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Funding Model: <strong className="text-foreground">On-Demand</strong> • Total Provided: ₹{selectedFunder.totalProvided.toLocaleString("en-IN")}
                  </p>
                </div>

                {selectedFunder.unallocatedReceived > 0 && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Existing Unallocated Capital Found
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-400">
                        Pool Capital
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg bg-card/60 border border-border/40">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Unallocated Available</span>
                        <span className="font-black text-primary text-xs">₹{selectedFunder.unallocatedReceived.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-card/60 border border-border/40">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Loan Required</span>
                        <span className="font-black text-foreground text-xs">₹{remainingNeeded.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-card/60 border border-border/40">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Use Unallocated</span>
                        <span className="font-black text-emerald-400 text-xs">
                          ₹{Math.min(selectedFunder.unallocatedReceived, Number(amount || remainingNeeded || 0)).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Using existing unallocated capital. No new funding advance will be created.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Funding Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Funding Amount for this Loan (₹) *</Label>
                {remainingNeeded > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(remainingNeeded.toString())}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    Fill Remaining Needed (₹{remainingNeeded.toLocaleString("en-IN")})
                  </button>
                )}
              </div>
              <Input
                type="number"
                placeholder="e.g. 10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`h-11 rounded-xl text-sm font-bold bg-accent/20 dark:bg-secondary/20 border-border/40 ${
                  isOverLoanNeeded ? "border-red-500 focus-visible:ring-red-500" : ""
                }`}
              />

              {/* Validation helper text */}
              {isOverLoanNeeded ? (
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

            {/* Date, Status & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <Label className="text-xs font-bold text-foreground">Funding Status *</Label>
                <select
                  value={fundingStatus}
                  onChange={(e) => setFundingStatus(e.target.value as any)}
                  className="w-full h-11 px-3 rounded-xl bg-accent/20 dark:bg-secondary/20 border border-border/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="allocated">Allocated</option>
                  <option value="received">Received</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Notes (Optional)</Label>
                <Input
                  type="text"
                  placeholder="e.g. On-demand transfer"
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
                    <span>Confirm Funding</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ── Inline "Add New Capital Person" Form ────────────────────────── */
          <form onSubmit={handleCreateNewFunder} className="space-y-3.5 pt-1 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-1 border-b border-border/30">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                Register New On-Demand Capital Person
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingFunder(false)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back to Select
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Name *</Label>
                <Input
                  placeholder="e.g. X or Person Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-accent/20 dark:bg-secondary/20 border-border/40 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Phone Number *</Label>
                <Input
                  type="tel"
                  placeholder="10-digit mobile"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-accent/20 dark:bg-secondary/20 border-border/40 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Notes (Optional)</Label>
              <Input
                placeholder="e.g. On-demand emergency funder"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="h-10 rounded-xl bg-accent/20 dark:bg-secondary/20 border-border/40 text-xs"
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              No fake pool balance required. Once created, you will record individual funding events as needed.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingFunder(false)}
                className="h-10 rounded-xl text-xs font-semibold px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingPending}
                size="sm"
                className="h-10 rounded-xl text-xs font-black fx-brand-gradient text-white border-0 fx-cta-glow px-5"
              >
                {isCreatingPending ? "Registering..." : "Create & Select"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
