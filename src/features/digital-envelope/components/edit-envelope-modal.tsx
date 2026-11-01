"use client";

import React, { useState, useEffect } from "react";
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
import { Edit2 } from "lucide-react";
import { toast } from "sonner";
import { updateEnvelopeAction } from "../actions/update-envelope.action";
import type { DigitalEnvelopeItem } from "../types";

interface EditEnvelopeModalProps {
  envelope: DigitalEnvelopeItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const COLORS = [
  { id: "gold", label: "Gold", bg: "bg-primary" },
  { id: "emerald", label: "Emerald", bg: "bg-emerald-500" },
  { id: "blue", label: "Blue", bg: "bg-blue-500" },
  { id: "purple", label: "Purple", bg: "bg-purple-500" },
  { id: "amber", label: "Amber", bg: "bg-amber-500" },
];

export function EditEnvelopeModal({
  envelope,
  open,
  onOpenChange,
  onSuccess,
}: EditEnvelopeModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [color, setColor] = useState("gold");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (envelope) {
      setName(envelope.name);
      setCategory(envelope.category || "");
      setTargetAmount(envelope.targetAmount ? String(envelope.targetAmount) : "");
      setColor(envelope.color || "gold");
      setNotes(envelope.notes || "");
    }
  }, [envelope]);

  if (!envelope) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateEnvelopeAction({
        envelopeId: envelope.envelopeId,
        name: name.trim(),
        category: category.trim(),
        targetAmount: targetAmount ? Number(targetAmount) : null,
        color,
        notes: notes.trim() || null,
      });

      if (res.success) {
        toast.success(res.message || "Envelope updated successfully!");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || "Failed to update envelope.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl border border-border/50 bg-card p-6">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Edit2 className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Edit Envelope Details
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Update name, target amount goal, theme, and notes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name" className="text-xs font-bold">
              Envelope Name *
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs rounded-xl h-10 font-semibold"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-category" className="text-xs font-bold">
              Category / Tag
            </Label>
            <Input
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-xs rounded-xl h-10"
            />
          </div>

          {/* Target Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-target" className="text-xs font-bold">
              Target Amount Goal (₹)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                id="edit-target"
                type="number"
                step="any"
                min="0"
                placeholder="Optional goal amount"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="pl-7 text-xs rounded-xl h-10"
              />
            </div>
          </div>

          {/* Theme Color */}
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
            <Label htmlFor="edit-notes" className="text-xs font-bold">
              Notes
            </Label>
            <Textarea
              id="edit-notes"
              rows={2}
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
              className="px-5 py-2 text-xs font-bold fx-brand-gradient text-white rounded-xl fx-pressable shadow-md disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

