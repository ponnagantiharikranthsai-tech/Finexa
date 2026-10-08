"use client";

import React, { useRef, useState, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLoans } from "@/features/loans/hooks/use-loans";
import type { LoanManagementDetailResult } from "@/features/loans/actions/get-loan-management-data.action";
import {
  CreditCard,
  ArrowUpRight,
  Activity,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

// Lazy-load DetailedAuditModal so its bundle is only downloaded on demand
const DetailedAuditModal = dynamic(
  () => import("@/features/loans/components/modals/detailed-audit-modal").then((m) => m.DetailedAuditModal),
  { ssr: false }
);

export function HomeVirtualizedFeed() {
  const { loans, isLoading, isBackgroundSyncing, refreshLoans } = useLoans();
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanManagementDetailResult | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSelectLoan = (loan: LoanManagementDetailResult) => {
    startTransition(() => {
      setSelectedLoan(loan);
      setAuditOpen(true);
    });
  };

  const rowVirtualizer = useVirtualizer({
    count: loans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // estimated row height
    overscan: 4,
  });

  return (
    <div className="w-full max-w-4xl px-6 relative z-10 mt-10">
      <div className="rounded-2xl border border-zinc-800/80 bg-[#141417]/90 backdrop-blur-xl p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100 tracking-tight">
                  Active Loans & Portfolio Feed
                </h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                0 ms IndexedDB read • 60 FPS hardware-accelerated scroll ({loans.length} loans)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isBackgroundSyncing && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400/80 font-mono">
                <RefreshCw className="h-3 w-3 animate-spin" /> Syncing
              </span>
            )}
            <Link
              href="/loan-management"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-amber-400/10"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Virtualized List Container */}
        {isLoading && loans.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
            <span>Loading active loans from cache...</span>
          </div>
        ) : loans.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs text-center">
            <CreditCard className="h-6 w-6 text-zinc-600" />
            <span>No loan records found. Click &quot;+ New Loan&quot; above to create one.</span>
          </div>
        ) : (
          <div
            ref={parentRef}
            className="h-[280px] w-full overflow-y-auto mt-3 pr-1 scrollbar-thin scrollbar-thumb-zinc-800"
          >
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const loan = loans[virtualRow.index];
                const isOverdue = loan.status === "overdue" || (new Date(loan.dueDate) < new Date() && loan.outstandingBalance > 0);
                const isSettled = loan.outstandingBalance <= 0 || loan.status === "closed";

                return (
                  <div
                    key={virtualRow.key}
                    onClick={() => handleSelectLoan(loan)}
                    className="absolute left-0 top-0 w-full transition-transform cursor-pointer"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="h-[56px] flex items-center justify-between rounded-xl border border-zinc-800/60 bg-[#19191e]/60 hover:bg-[#202026] hover:border-amber-500/30 px-3.5 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-zinc-800/80 border border-zinc-700/40 flex items-center justify-center text-xs font-mono font-bold text-zinc-300 group-hover:text-amber-400 transition-colors">
                          #{loan.loanId.slice(-4)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
                            {loan.borrower.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            {loan.borrower.mobile} • Due: {loan.dueDate}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-mono font-bold text-amber-400">
                            ₹{Number(loan.principal).toLocaleString("en-IN")}
                          </p>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider ${
                              isSettled
                                ? "text-zinc-500"
                                : isOverdue
                                ? "text-rose-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {isSettled ? "Settled" : isOverdue ? "Overdue" : "Active"}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lazy-Loaded Detailed Audit Modal */}
      {auditOpen && selectedLoan && (
        <DetailedAuditModal
          open={auditOpen}
          onOpenChange={setAuditOpen}
          loan={selectedLoan}
          onEditKyc={() => {}}
          onAllocateCapital={() => {}}
          onDeleteBorrower={() => {}}
        />
      )}
    </div>
  );
}
