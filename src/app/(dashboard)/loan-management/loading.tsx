import React from "react";
import { CreditCard } from "lucide-react";

export default function LoanManagementLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified borrower details, KYC, and loan portfolio management.
          </p>
        </div>
      </div>

      {/* Search & Filter bar skeleton */}
      <div className="fx-glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72 h-10 rounded-xl bg-accent/40 animate-pulse" />
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="w-28 h-10 rounded-xl bg-accent/40 animate-pulse" />
          <div className="w-28 h-10 rounded-xl bg-accent/40 animate-pulse" />
        </div>
      </div>

      {/* Loan Cards Skeleton Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-[22px] border border-border/40 p-5 bg-card/60 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent/50 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded bg-accent/60 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-accent/40 animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-16 rounded-full bg-accent/40 animate-pulse" />
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex justify-between">
                <div className="h-3 w-20 rounded bg-accent/40 animate-pulse" />
                <div className="h-4 w-24 rounded bg-accent/60 animate-pulse" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-24 rounded bg-accent/40 animate-pulse" />
                <div className="h-3 w-16 rounded bg-accent/40 animate-pulse" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/30">
              <div className="h-9 w-24 rounded-xl bg-accent/40 animate-pulse" />
              <div className="h-9 w-24 rounded-xl bg-accent/40 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
