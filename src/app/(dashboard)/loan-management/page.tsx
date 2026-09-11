"use client";

import React from "react";
import { useLoanManagementData } from "@/features/loans/hooks/use-loan-management-data";
import { LoanManagementList } from "@/features/loans/components/loan-management-list";
import { CreditCard, RefreshCw } from "lucide-react";

export default function LoanManagementPage() {
  // 1. Instant 0 ms read from device IndexedDB, with background sync to Supabase
  const { loans, isLoading, isBackgroundSyncing, refreshLoans } = useLoanManagementData();

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
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

        {/* Discrete WhatsApp/Instagram-style Sync Badge */}
        <div className="flex items-center gap-2">
          {isBackgroundSyncing && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary animate-pulse select-none">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Instant Render: renders cached loans immediately from IndexedDB */}
      {isLoading && loans.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Loading loans...</p>
        </div>
      ) : (
        <LoanManagementList initialLoans={loans} />
      )}
    </div>
  );
}
