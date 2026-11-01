"use client";

import React from "react";
import { Landmark, PiggyBank, Users, Clock, ArrowUpRight, Scale } from "lucide-react";
import type { DigitalEnvelopeSummary } from "../types";

interface TopSummaryCardsProps {
  summary: DigitalEnvelopeSummary;
  onOpenReconcile: () => void;
}

const fmt = (val: number | string | undefined | null) =>
  (Number(val) || 0).toLocaleString("en-IN");

export function TopSummaryCards({ summary, onOpenReconcile }: TopSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* 1. Total Account 2 Balance */}
      <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-primary/30 bg-card/70 backdrop-blur-xl flex flex-col justify-between space-y-3 fx-3d-hover shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Total Account 2 Balance
          </span>
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Landmark className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-primary">₹</span>
            <p className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              {fmt(summary.totalAccount2Balance)}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
            <span>Live sum of all envelopes</span>
            <span className="font-semibold text-primary/80">
              {summary.personalEnvelopesCount + summary.thirdPartyEnvelopesCount} buckets
            </span>
          </p>
        </div>
      </div>

      {/* 2. My Net Envelopes */}
      <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-emerald-500/20 bg-card/70 backdrop-blur-xl flex flex-col justify-between space-y-3 fx-3d-hover shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            My Net Envelopes
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <PiggyBank className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">₹</span>
            <p className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {fmt(summary.myNetEnvelopes)}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
            <span>Personal (EMI + Savings + Inv)</span>
            <span className="font-semibold text-foreground/80">
              {summary.personalEnvelopesCount} items
            </span>
          </p>
        </div>
      </div>

      {/* 3. Third-Party Funds */}
      <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-amber-500/25 bg-card/70 backdrop-blur-xl flex flex-col justify-between space-y-3 fx-3d-hover shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Third-Party Funds
          </span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">₹</span>
            <p className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {fmt(summary.thirdPartyFunds)}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
            <span>Held for external parties</span>
            <span className="font-semibold text-foreground/80">
              {summary.thirdPartyEnvelopesCount} friends
            </span>
          </p>
        </div>
      </div>

      {/* 4. Unallocated Cash */}
      <div className="fx-glass-card rounded-[22px] p-4 md:p-5 border border-blue-500/20 bg-card/70 backdrop-blur-xl flex flex-col justify-between space-y-3 fx-3d-hover shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Unallocated Cash
          </span>
          <button
            type="button"
            onClick={onOpenReconcile}
            title="Reconcile Account 2 Bank Statement Balance"
            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1 text-[10px] font-semibold"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Reconcile</span>
          </button>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">₹</span>
            <p className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
              {fmt(summary.unallocatedCash)}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
            <span>Bank balance not tagged yet</span>
            {summary.unallocatedCash > 0 && (
              <span className="text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Ready to allocate
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

