"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, PiggyBank, Users, Wallet, Coins } from "lucide-react";
import { toast } from "sonner";
import { createEnvelopeAction } from "../actions/create-envelope.action";
import type { EnvelopeType } from "../types";

interface CreateEnvelopeModalProps {
  unallocatedCash: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CATEGORY_SUGGESTIONS = [
  "EMI",
  "Savings",
  "Investment",
  "Friend / Third Party",
  "Emergency Fund",
  "Insurance",
  "Utilities",
  "Travel & Leisure",
];

const COLORS = [
  { id: "gold", label: "Gold", bg: "bg-primary" },
  { id: "emerald", label: "Emerald", bg: "bg-emerald-500" },
  { id: "blue", label: "Blue", bg: "bg-blue-500" },
  { id: "purple", label: "Purple", bg: "bg-purple-500" },
  { id: "amber", label: "Amber", bg: "bg-amber-500" },
];

export function CreateEnvelopeModal({
  unallocatedCash,
  open,
  onOpenChange,
  onSuccess,
}: CreateEnvelopeModalProps) {
  const [type, setType] = useState<EnvelopeType>("personal");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("EMI");
  const [initialAmount, setInitialAmount] = useState("");
  const [fundSource, setFundSource] = useState<"external" | "unallocated_cash">("external");
  const [targetAmount, setTargetAmount] = useState("");
  const [color, setColor] = useState("gold");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTypeChange = (newType: EnvelopeType) => {
    setType(newType);
    if (newType === "third_party") {
      setCategory("Friend / Third Party");
      setColor("amber");
    } else {
      setCategory("EMI");
      setColor("gold");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a name for the envelope.");
      return;
    }

    const initAmt = Number(initialAmount) || 0;
    if (initAmt < 0) {
      toast.error("Initial amount cannot be negative.");
      return;
    }

    if (fundSource === "unallocated_cash" && initAmt > unallocatedCash) {
      toast.error(
        `Initial amount ₹${initAmt.toLocaleString("en-IN")} exceeds unallocated cash ₹${unallocatedCash.toLocaleString("en-IN")}`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createEnvelopeAction({
        name: name.trim(),
        category: category.trim(),
        type,
        initialAmount: initAmt,
        targetAmount: targetAmount ? Number(targetAmount) : undefined,
        color,
        notes: notes.trim() || undefined,
        fundSource,
      });

      if (res.success && res.data) {
        toast.success(res.message || `Created envelope "${res.data.name}"!`);
        setName("");
        setInitialAmount("");
        setTargetAmount("");
        setNotes("");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || "Failed to create envelope.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border border-border/50 bg-card p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Plus className="h-4 w-4 stroke-[3]" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Create New Envelope
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Set up a dedicated digital bucket to partition your Account 2 funds.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Section / Type Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Envelope Classification *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("personal")}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  type === "personal"
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                    : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <PiggyBank className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Personal Bucket</span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  EMI, Savings, Investments
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange("third_party")}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  type === "third_party"
                    ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500"
                    : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-foreground">Third-Party Funds</span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Friend 1, Friend 2, Held cash
                </span>
              </button>
            </div>
          </div>

          {/* Envelope Name */}
          <div className="space-y-1.5">
            <Label htmlFor="env-name" className="text-xs font-bold">
              Envelope Name *
            </Label>
            <Input
              id="env-name"
              placeholder={
                type === "personal"
                  ? "e.g., Car Loan EMI, Emergency Buffer, SIP Mutual Funds"
                  : "e.g., Friend 1 - Rahul, Friend 2 - Priya, Client Retainer"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs rounded-xl h-10 font-semibold"
              required
              autoFocus
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="env-category" className="text-xs font-bold">
              Category / Tag
            </Label>
            <Input
              id="env-category"
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-xs rounded-xl h-10"
              placeholder="e.g., EMI, Savings, Friend, Investment"
            />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Initial Amount & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="env-init-amt" className="text-xs font-bold">
                Initial Amount (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="env-init-amt"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  className="pl-7 text-xs rounded-xl h-10 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="env-target-amt" className="text-xs font-bold">
                Target Goal (Optional)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="env-target-amt"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g., 5000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="pl-7 text-xs rounded-xl h-10"
                />
              </div>
            </div>
          </div>

          {/* If initial amount > 0, choose fund source */}
          {Number(initialAmount) > 0 && (
            <div className="space-y-1.5 p-3 rounded-xl bg-secondary/50 border border-border/50">
              <Label className="text-xs font-bold block mb-1">Initial Funding Source</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFundSource("external")}
                  className={`p-2 rounded-lg text-left text-xs transition-all border ${
                    fundSource === "external"
                      ? "bg-card border-primary text-foreground font-bold shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5 text-primary mb-1 inline mr-1" />
                  Direct Bank Credit
                </button>
                <button
                  type="button"
                  onClick={() => setFundSource("unallocated_cash")}
                  className={`p-2 rounded-lg text-left text-xs transition-all border ${
                    fundSource === "unallocated_cash"
                      ? "bg-card border-blue-500 text-foreground font-bold shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Coins className="h-3.5 w-3.5 text-blue-500 mb-1 inline mr-1" />
                  From Unallocated (₹{unallocatedCash.toLocaleString("en-IN")})
                </button>
              </div>
            </div>
          )}

          {/* Color theme */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Theme Color</Label>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`h-7 w-7 rounded-full ${c.bg} flex items-center justify-center transition-all ${
                    color === c.id ? "ring-2 ring-foreground scale-110" : "opacity-70 hover:opacity-100"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="env-notes" className="text-xs font-bold">
              Notes / Description (Optional)
            </Label>
            <Textarea
              id="env-notes"
              rows={2}
              placeholder="e.g., Hold money till Rahul returns from Mumbai, or due on the 5th of every month..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-accent/40 rounded-xl transition-colors border border-border/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-bold fx-brand-gradient text-white rounded-xl fx-pressable shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              {isSubmitting ? "Creating..." : "Create Envelope"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

