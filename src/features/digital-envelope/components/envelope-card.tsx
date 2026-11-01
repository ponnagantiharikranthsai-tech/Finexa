"use client";

import React from "react";
import {
  CreditCard,
  PiggyBank,
  TrendingUp,
  User,
  Plus,
  ArrowUpRight,
  MoreVertical,
  Edit2,
  Trash2,
  History,
  Target,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DigitalEnvelopeItem } from "../types";

interface EnvelopeCardProps {
  envelope: DigitalEnvelopeItem;
  onAddMoney: (envelope: DigitalEnvelopeItem) => void;
  onPayBillWithdraw: (envelope: DigitalEnvelopeItem) => void;
  onEdit: (envelope: DigitalEnvelopeItem) => void;
  onDelete: (envelope: DigitalEnvelopeItem) => void;
  onViewHistory: (envelope: DigitalEnvelopeItem) => void;
}

const fmt = (val: number | string | undefined | null) =>
  (Number(val) || 0).toLocaleString("en-IN");

const getEnvelopeIcon = (iconName?: string | null, category?: string) => {
  const cat = (category || "").toLowerCase();
  if (iconName === "piggy-bank" || cat.includes("saving")) return PiggyBank;
  if (iconName === "trending-up" || cat.includes("invest")) return TrendingUp;
  if (iconName === "user" || cat.includes("friend") || cat.includes("third")) return User;
  if (iconName === "credit-card" || cat.includes("emi") || cat.includes("loan")) return CreditCard;
  return CreditCard;
};

const getColorClasses = (color?: string | null, type?: string) => {
  if (type === "third_party") {
    return {
      border: "border-amber-500/25",
      badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      accent: "text-amber-600 dark:text-amber-400",
      progress: "bg-amber-500",
    };
  }

  switch (color) {
    case "emerald":
      return {
        border: "border-emerald-500/25",
        badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        accent: "text-emerald-600 dark:text-emerald-400",
        progress: "bg-emerald-500",
      };
    case "purple":
      return {
        border: "border-purple-500/25",
        badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        iconBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
        accent: "text-purple-600 dark:text-purple-400",
        progress: "bg-purple-500",
      };
    case "blue":
      return {
        border: "border-blue-500/25",
        badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
        accent: "text-blue-600 dark:text-blue-400",
        progress: "bg-blue-500",
      };
    default:
      return {
        border: "border-primary/25",
        badge: "bg-primary/10 text-primary border-primary/20",
        iconBg: "bg-primary/15 text-primary",
        accent: "text-primary",
        progress: "bg-primary",
      };
  }
};

export function EnvelopeCard({
  envelope,
  onAddMoney,
  onPayBillWithdraw,
  onEdit,
  onDelete,
  onViewHistory,
}: EnvelopeCardProps) {
  const Icon = getEnvelopeIcon(envelope.icon, envelope.category);
  const colorTheme = getColorClasses(envelope.color, envelope.type);

  const progressPercent =
    envelope.targetAmount && envelope.targetAmount > 0
      ? Math.min(100, Math.round((envelope.balance / envelope.targetAmount) * 100))
      : null;

  return (
    <div
      className={`fx-glass-card rounded-[20px] p-5 border ${colorTheme.border} bg-card/75 backdrop-blur-xl flex flex-col justify-between space-y-4 fx-3d-hover shadow-sm hover:shadow-md transition-all group relative`}
    >
      {/* Header: Icon, Name & Category Badge, Actions Dropdown */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-11 w-11 rounded-2xl ${colorTheme.iconBg} flex items-center justify-center shrink-0 shadow-sm`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
              {envelope.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${colorTheme.badge}`}
              >
                {envelope.category}
              </span>
              {envelope.type === "third_party" && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  • External Holder
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            <DropdownMenuItem
              onClick={() => onEdit(envelope)}
              className="flex items-center gap-2 text-xs cursor-pointer"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onViewHistory(envelope)}
              className="flex items-center gap-2 text-xs cursor-pointer"
            >
              <History className="h-3.5 w-3.5" />
              <span>View Movement Logs</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(envelope)}
              className="flex items-center gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Envelope</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Balance & Optional Target progress */}
      <div className="space-y-2 pt-1">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Current Available Balance
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-base font-bold ${colorTheme.accent}`}>₹</span>
            <span className="text-3xl font-black text-foreground tracking-tight">
              {fmt(envelope.balance)}
            </span>
          </div>
        </div>

        {/* Progress toward target if target exists */}
        {envelope.targetAmount && envelope.targetAmount > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                Target: ₹{fmt(envelope.targetAmount)}
              </span>
              <span className="font-semibold text-foreground">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full ${colorTheme.progress} transition-all duration-500`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Notes preview */}
        {envelope.notes && (
          <p className="text-[11px] text-muted-foreground/90 line-clamp-1 italic pt-0.5">
            "{envelope.notes}"
          </p>
        )}
      </div>

      {/* Action Buttons: "+ Add Money" and "💳 Pay Bill / Withdraw" */}
      <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onAddMoney(envelope)}
          className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all fx-pressable border border-primary/25"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>+ Add Money</span>
        </button>

        <button
          type="button"
          onClick={() => onPayBillWithdraw(envelope)}
          className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-secondary hover:bg-accent/70 text-foreground text-xs font-bold transition-all fx-pressable border border-border/60 shadow-xs hover:border-primary/40"
        >
          <span>💳 Pay / Withdraw</span>
        </button>
      </div>
    </div>
  );
}
