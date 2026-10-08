"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Landmark,
  UserPlus,
  Coins,
  AlertCircle,
  CheckCircle2,
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

type Step = "SELECT" | "CREATE";

const LABEL = "block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5";
const INPUT = "w-full h-11 px-4 rounded-xl bg-[#27272a] border border-zinc-700/60 text-sm font-medium text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/60 focus:border-yellow-500/60 transition-colors";
const SELECT_CLS = "w-full h-11 px-4 rounded-xl bg-[#27272a] border border-zinc-700/60 text-sm font-medium text-zinc-100 focus:outline-none focus:ring-1 focus:ring-yellow-500/60 focus:border-yellow-500/60 transition-colors";

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
  const [step, setStep] = useState<Step>("SELECT");

  const [selectedFunderId, setSelectedFunderId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [allocationDate, setAllocationDate] = useState<string>(new Date().toISOString().split("T")[0]!);
  const [fundingStatus, setFundingStatus] = useState<"allocated" | "received" | "pending">("allocated");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isCreatingPending, startCreateTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setStep("SELECT");
      loadFunders();
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
      if (res.data.length > 0 && !selectedFunderId) setSelectedFunderId(res.data[0]!.funderId);
    } else {
      toast.error("Failed to load capital providers.");
    }
    setLoadingFunders(false);
  };

  const selectedFunder = funders.find((f) => f.funderId === selectedFunderId);
  const loanPrincipal = loan ? Number(loan.principal) : 0;
  const alreadyFunded = loan?.funding ? loan.funding.totalFunded : 0;
  const remainingNeeded = Math.max(0, loanPrincipal - alreadyFunded);
  const numAmount = Number(amount) || 0;
  const isOverLoanNeeded = numAmount > remainingNeeded;
  const isValidAmount = numAmount > 0 && !isOverLoanNeeded;

  const handleCreateNewFunder = async (e: React.FormEvent) => {
    e.preventDefault();
    const funderName = newName.trim();
    const funderPhone = newMobile.trim();
    const funderNotes = newNotes.trim();
    if (!funderName || !funderPhone) { toast.error("Please enter name and mobile number."); return; }

    startCreateTransition(async () => {
      let createdFunderId: string | null = null;
      let createdFunderName: string = funderName;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.from("funders").insert([{
          name: funderName, mobile: funderPhone, status: "active",
          notes: funderNotes || null,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]).select().single();
        if (!error && data) { createdFunderId = data.funder_id; createdFunderName = data.name || funderName; }
      } catch (_) {}

      if (!createdFunderId) {
        const res = await createFunderAction({ name: funderName, mobile: funderPhone, status: "active", notes: funderNotes || null, fundingModel: "on_demand", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        if (res.success && res.data) { createdFunderId = res.data.funderId; createdFunderName = res.data.name; }
        else { toast.error(typeof res.error === "string" ? res.error : "Failed to register capital person."); return; }
      }

      toast.success(`Capital person "${createdFunderName}" registered successfully!`);
      await loadFunders();
      setSelectedFunderId(createdFunderId);
      setStep("SELECT");
      setNewName(""); setNewMobile(""); setNewNotes("");
      if (remainingNeeded > 0) setAmount(remainingNeeded.toString());
    });
  };

  const handleConfirmAllocation = async () => {
    if (!loan || !selectedFunderId || !isValidAmount) {
      toast.error("Please select a capital person and enter a valid funding amount.");
      return;
    }

    const targetLoanId = loan.loanId;
    await queryClient.cancelQueries({ queryKey: LOANS_QUERY_KEY });
    const previousLoans = queryClient.getQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY);

    // Optimistically update loan funding in TanStack Query cache
    queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (old) => {
      if (!old) return [];
      return old.map((l) => {
        if (l.loanId !== targetLoanId) return l;
        const currentSources = l.funding?.sources || [];
        const newTotalFunded = (l.funding?.totalFunded || 0) + numAmount;
        const newRemaining = Math.max(0, Number(l.principal) - newTotalFunded);
        const newSource = {
          allocationId: `temp-${Date.now()}`,
          funderId: selectedFunderId,
          funderName: selectedFunder?.name || "Capital Partner",
          funderMobile: selectedFunder?.mobile || "",
          amount: numAmount,
          funderSharePercentage: (numAmount / Number(l.principal)) * 100,
          allocationDate,
          notes: notes.trim() || null,
        };

        return {
          ...l,
          funding: {
            ...l.funding,
            totalFunded: newTotalFunded,
            remainingRequired: newRemaining,
            isFullyFunded: newRemaining <= 0,
            isPartiallyFunded: newTotalFunded > 0 && newRemaining > 0,
            isUnfunded: newTotalFunded === 0,
            sources: [...currentSources, newSource],
          },
        };
      });
    });

    toast.success(`Successfully linked ₹${numAmount.toLocaleString("en-IN")} from ${selectedFunder?.name} to ${loan.borrower.name}!`);
    if (onSuccess) onSuccess();
    onOpenChange(false);

    setIsSubmitting(true);
    try {
      const res = await allocateCapitalAction({
        loanId: loan.loanId,
        funderId: selectedFunderId,
        amount: numAmount,
        allocationDate,
        status: fundingStatus,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
      } else {
        if (previousLoans) {
          queryClient.setQueryData(LOANS_QUERY_KEY, previousLoans);
        }
        toast.error(typeof res.error === "string" ? res.error : "Failed to record capital funding.");
      }
    } catch {
      if (previousLoans) {
        queryClient.setQueryData(LOANS_QUERY_KEY, previousLoans);
      }
      toast.error("Failed to record capital funding.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-xl w-full" style={{ maxWidth: "36rem" }}>
        <div className="flex flex-col max-h-[85vh] bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">

          {/* STICKY HEADER */}
          <div className="shrink-0 px-6 pt-5 pb-4 border-b border-zinc-800">
            {step === "SELECT" ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Landmark className="h-4 w-4 text-yellow-400 shrink-0" />
                    <h2 className="text-base font-black tracking-tight text-zinc-100">On-Demand Capital Funding</h2>
                  </div>
                  <p className="text-xs text-zinc-500">Connect a capital provider to fund this loan.</p>
                </div>
                {loan && (
                  <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    Rs.{Number(loan.principal).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStep("SELECT")} className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-yellow-400 transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Funder Selection
                </button>
                <span className="text-zinc-700">·</span>
                <div className="flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-yellow-400" />
                  <h2 className="text-base font-black tracking-tight text-zinc-100">Register New Capital Person</h2>
                </div>
              </div>
            )}
          </div>

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {step === "SELECT" ? (
              <>
                {/* Loan summary */}
                {loan && (
                  <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 pb-2.5 border-b border-zinc-800">
                      <span>Borrower: <strong className="text-zinc-100 font-bold">{loan.borrower.name}</strong></span>
                      <span className="text-zinc-500">{loan.borrower.mobile}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: "Required", value: loanPrincipal, color: "text-zinc-100" },
                        { label: "Funded", value: alreadyFunded, color: "text-emerald-400" },
                        { label: "Still Needed", value: remainingNeeded, color: "text-yellow-400" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-lg bg-zinc-800/60 p-2.5">
                          <p className="text-[10px] uppercase font-bold text-zinc-500 mb-1">{label}</p>
                          <p className={`text-sm font-extrabold ${color}`}>Rs.{value.toLocaleString("en-IN")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing sources */}
                {loan?.funding && loan.funding.sources.length > 0 && (
                  <div>
                    <p className={LABEL}>Current Capital Sources ({loan.funding.sources.length})</p>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {loan.funding.sources.map((s) => (
                        <div key={s.allocationId} className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/40 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-100">{s.funderName}</span>
                            <span className="text-zinc-500">({s.funderSharePercentage}%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-yellow-400">Rs.{s.amount.toLocaleString("en-IN")}</span>
                            <button type="button" onClick={() => { onOpenChange(false); router.push(`/capital-management?funderId=${s.funderId}`); }} className="text-zinc-500 hover:text-yellow-400 transition-colors" title="View in Capital Management">
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Funder selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`${LABEL} mb-0`}>Capital Person / Funder *</label>
                    <button type="button" onClick={() => setStep("CREATE")} className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/25 px-2.5 py-1 rounded-lg transition-all">
                      <Plus className="h-3 w-3" /> Add New Capital Person
                    </button>
                  </div>
                  {loadingFunders ? (
                    <div className="h-11 flex items-center gap-2 px-4 rounded-xl bg-zinc-800 border border-zinc-700/60 text-xs text-zinc-500">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-yellow-400" /> Loading capital providers...
                    </div>
                  ) : funders.length === 0 ? (
                    <div className="p-4 text-center rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-xs space-y-3">
                      <p className="text-zinc-400">No capital providers registered yet.</p>
                      <button type="button" onClick={() => setStep("CREATE")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-500 text-zinc-900 text-xs font-black hover:bg-yellow-400 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Add First Capital Person
                      </button>
                    </div>
                  ) : (
                    <select value={selectedFunderId} onChange={(e) => setSelectedFunderId(e.target.value)} className={SELECT_CLS}>
                      <option value="">-- Choose a Capital Person --</option>
                      {funders.map((f) => (
                        <option key={f.funderId} value={f.funderId}>
                          {f.name} {f.unallocatedReceived > 0 ? `(Unallocated: Rs.${f.unallocatedReceived.toLocaleString("en-IN")})` : "(On-Demand)"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Selected funder card */}
                {selectedFunder && (
                  <div className="space-y-2">
                    <div className="px-4 py-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-xs flex items-center justify-between">
                      <span className="font-bold text-zinc-100 flex items-center gap-1.5"><Coins className="h-4 w-4 text-yellow-400" />{selectedFunder.name}</span>
                      <span className="text-zinc-500">{selectedFunder.mobile}</span>
                    </div>
                    {selectedFunder.unallocatedReceived > 0 && (
                      <div className="px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Existing Unallocated Capital Found</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-400">Pool Capital</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Unallocated", value: selectedFunder.unallocatedReceived, color: "text-yellow-400" },
                            { label: "Loan Needs", value: remainingNeeded, color: "text-zinc-100" },
                            { label: "Will Use", value: Math.min(selectedFunder.unallocatedReceived, numAmount || remainingNeeded || 0), color: "text-emerald-400" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-center">
                              <p className="text-[9px] uppercase font-bold text-zinc-500 mb-0.5">{label}</p>
                              <p className={`text-xs font-black ${color}`}>Rs.{value.toLocaleString("en-IN")}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-emerald-500/80">Using existing unallocated capital. No new advance will be created.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`${LABEL} mb-0`}>Funding Amount (Rs.) *</label>
                    {remainingNeeded > 0 && (
                      <button type="button" onClick={() => setAmount(remainingNeeded.toString())} className="text-[11px] font-bold text-yellow-400 hover:text-yellow-300 transition-colors">
                        Fill Rs.{remainingNeeded.toLocaleString("en-IN")}
                      </button>
                    )}
                  </div>
                  <input type="number" placeholder="e.g. 10000" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${INPUT} ${isOverLoanNeeded ? "border-red-500/60 focus:ring-red-500/40" : ""}`} />
                  {isOverLoanNeeded ? (
                    <p className="mt-1.5 text-[11px] text-red-400 font-bold flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />Over-allocation — max Rs.{remainingNeeded.toLocaleString("en-IN")}</p>
                  ) : isValidAmount ? (
                    <p className="mt-1.5 text-[11px] text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3 w-3 shrink-0" />Valid — funds {Math.round((numAmount / loanPrincipal) * 100)}% of this loan</p>
                  ) : null}
                </div>

                {/* Date, Status, Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL}>Funding Date *</label>
                    <input type="date" value={allocationDate} onChange={(e) => setAllocationDate(e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Funding Status *</label>
                    <select value={fundingStatus} onChange={(e) => setFundingStatus(e.target.value as any)} className={SELECT_CLS}>
                      <option value="allocated">Allocated</option>
                      <option value="received">Received</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Ref / Notes</label>
                    <input type="text" placeholder="Optional reference" value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT} />
                  </div>
                </div>
              </>
            ) : (
              /* CREATE STEP */
              <form id="create-funder-form" onSubmit={handleCreateNewFunder} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Full Name *</label>
                    <input type="text" placeholder="e.g. Ramesh Kumar" value={newName} onChange={(e) => setNewName(e.target.value)} required className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Phone Number *</label>
                    <input type="tel" placeholder="10-digit mobile" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} required className={INPUT} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Notes (Optional)</label>
                  <input type="text" placeholder="e.g. Emergency on-demand funder" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className={INPUT} />
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  No pool balance required. Once created, you will be taken back to record the actual funding amount for this loan.
                </p>
              </form>
            )}
          </div>

          {/* STICKY FOOTER */}
          <div className="shrink-0 px-6 py-4 border-t border-zinc-800 flex items-center justify-between gap-3">
            {step === "SELECT" ? (
              <>
                <button type="button" onClick={() => onOpenChange(false)} className="h-11 px-5 rounded-xl bg-[#27272a] border border-zinc-700/60 text-sm font-bold text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 transition-colors">
                  Cancel
                </button>
                <button type="button" disabled={!isValidAmount || isSubmitting || !selectedFunderId} onClick={handleConfirmAllocation} className="h-11 px-6 rounded-xl bg-yellow-500 text-zinc-900 text-sm font-black hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                  {isSubmitting ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" />Allocating...</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4" />Confirm Allocation</>
                  )}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep("SELECT")} className="h-11 px-5 rounded-xl bg-[#27272a] border border-zinc-700/60 text-sm font-bold text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 transition-colors flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button type="submit" form="create-funder-form" disabled={isCreatingPending} className="h-11 px-6 rounded-xl bg-yellow-500 text-zinc-900 text-sm font-black hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                  {isCreatingPending ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" />Registering...</>
                  ) : (
                    <><UserPlus className="h-4 w-4" />Create &amp; Select</>
                  )}
                </button>
              </>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
