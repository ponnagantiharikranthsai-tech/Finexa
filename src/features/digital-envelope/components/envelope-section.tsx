"use client";

import React from "react";
import { PiggyBank, Users, Plus } from "lucide-react";
import { EnvelopeCard } from "./envelope-card";
import type { DigitalEnvelopeItem, EnvelopeType } from "../types";

interface EnvelopeSectionProps {
  title: string;
  type: EnvelopeType;
  description: string;
  envelopes: DigitalEnvelopeItem[];
  totalBalance: number;
  onAddEnvelope: (type: EnvelopeType) => void;
  onAddMoney: (envelope: DigitalEnvelopeItem) => void;
  onPayBillWithdraw: (envelope: DigitalEnvelopeItem) => void;
  onEdit: (envelope: DigitalEnvelopeItem) => void;
  onDelete: (envelope: DigitalEnvelopeItem) => void;
  onViewHistory: (envelope: DigitalEnvelopeItem) => void;
}

const fmt = (val: number | string | undefined | null) =>
  (Number(val) || 0).toLocaleString("en-IN");

export function EnvelopeSection({
  title,
  type,
  description,
  envelopes,
  totalBalance,
  onAddEnvelope,
  onAddMoney,
  onPayBillWithdraw,
  onEdit,
  onDelete,
  onViewHistory,
}: EnvelopeSectionProps) {
  const isPersonal = type === "personal";
  const Icon = isPersonal ? PiggyBank : Users;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
              isPersonal
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-secondary text-muted-foreground">
                {envelopes.length} {envelopes.length === 1 ? "envelope" : "envelopes"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Subtotal badge */}
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Subtotal
            </span>
            <span
              className={`font-black text-sm ${
                isPersonal
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              ₹{fmt(totalBalance)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onAddEnvelope(type)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-secondary hover:bg-accent/70 text-foreground text-xs font-bold transition-all border border-border/50 fx-pressable"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>+ Add Envelope</span>
          </button>
        </div>
      </div>

      {/* Envelopes Grid */}
      {envelopes.length === 0 ? (
        <div className="p-8 rounded-[20px] border border-dashed border-border/70 text-center space-y-2 bg-card/30">
          <Icon className="h-8 w-8 text-muted-foreground mx-auto stroke-[1.5]" />
          <h3 className="text-xs font-bold text-foreground">No {title.toLowerCase()} configured</h3>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Create an envelope to tag your funds into this section.
          </p>
          <button
            type="button"
            onClick={() => onAddEnvelope(type)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create First Envelope</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {envelopes.map((env) => (
            <EnvelopeCard
              key={env.envelopeId}
              envelope={env}
              onAddMoney={onAddMoney}
              onPayBillWithdraw={onPayBillWithdraw}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewHistory={onViewHistory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

