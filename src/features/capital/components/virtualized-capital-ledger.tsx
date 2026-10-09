"use client";

import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LedgerTransactionItem } from "../actions/get-funder-ledger.action";
import { Coins, ChevronRight, CreditCard, ArrowDownRight, ExternalLink, Calendar, CheckCircle2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

export interface VirtualizedCapitalLedgerProps {
  transactions: LedgerTransactionItem[];
  onSelectTransaction: (tx: LedgerTransactionItem) => void;
  funderName?: string;
  maxHeight?: string;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("en-IN");
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Status and Type badge for capital ledger items
 */
function TransactionStatusBadge({ tx }: { tx: LedgerTransactionItem }) {
  if (tx.sourceType === "capital_return" || tx.status === "returned" || tx.transactionCode?.startsWith("CP-")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400">
        <CheckCircle2 size={10} /> Returned
      </span>
    );
  }

  if (tx.type === "FUNDING" && tx.loanId) {
    if (tx.currentlyAllocated === 0 && (tx.originalAmount || tx.amount) > 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          <CheckCircle2 size={10} /> Fully Returned
        </span>
      );
    }
    if (tx.returnedFromBorrower > 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
          <Clock size={10} /> Partially Returned
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
        <CheckCircle2 size={10} /> Allocated
      </span>
    );
  }

  if (tx.status === "received" || tx.status === "unallocated" || tx.type === "UNALLOCATED" || !tx.loanId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
        <Clock size={10} /> Unallocated
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700/50 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
      {tx.status}
    </span>
  );
}

/**
 * VirtualizedCapitalLedger
 * 60 FPS Virtualized Capital Transactions & Partner Ledger Queue with dark glassmorphic styling
 */
export function VirtualizedCapitalLedger({
  transactions,
  onSelectTransaction,
  funderName = "Capital Partner",
  maxHeight = "calc(100vh - 300px)",
}: VirtualizedCapitalLedgerProps) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);

  // Initialize row virtualizer with ~92px item height
  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 6,
  });

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-zinc-800/80 bg-[#121215] px-4 shadow-xl">
        <div className="h-14 w-14 rounded-2xl bg-[#18181b] border border-zinc-800/80 flex items-center justify-center mb-4 text-zinc-400 shadow-inner">
          <Coins className="h-7 w-7 text-amber-400/80" />
        </div>
        <p className="font-semibold text-zinc-100 text-sm">No funding transactions found</p>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm">
          No records matched your search filters or funding parameters.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      style={{ height: maxHeight, minHeight: "440px" }}
      className="w-full overflow-y-auto rounded-2xl border border-zinc-800/80 bg-[#121215] p-2.5 sm:p-3 shadow-2xl relative scrollbar-thin scrollbar-thumb-zinc-800"
    >
      {/* Total virtual container height */}
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const tx = transactions[virtualRow.index];
          const displayAmount = tx.originalAmount || tx.amount;

          return (
            <div
              key={virtualRow.key}
              onClick={() => onSelectTransaction(tx)}
              className="absolute left-0 top-0 w-full transition-transform"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="group mx-1 mb-2.5 flex h-[82px] items-center justify-between rounded-xl border border-zinc-800/80 bg-[#18181b] px-4 py-2.5 cursor-pointer transition-all duration-200 hover:border-yellow-500/40 hover:bg-[#202024] hover:shadow-lg hover:shadow-black/40">
                {/* Left: Code, Date, Target identity & Loan reference */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                  <div className="flex flex-col shrink-0">
                    <span className="font-mono text-xs font-semibold text-zinc-400 group-hover:text-amber-400 transition-colors">
                      {tx.transactionCode}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                      <Calendar size={10} className="text-zinc-600" />
                      {formatDate(tx.fundingDate)}
                    </span>
                  </div>

                  <div className="h-8 w-px bg-zinc-800/80 hidden sm:block shrink-0" />

                  <div className="min-w-0 flex-1">
                    {tx.sourceType === "capital_return" || tx.transactionCode?.startsWith("CP-") || tx.status === "returned" ? (
                      <div>
                        <p className="text-sm font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors truncate">
                          Paid Back to {funderName}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">
                          Capital Principal Repayment
                        </p>
                      </div>
                    ) : tx.borrowerName ? (
                      <div>
                        <p className="text-sm font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors truncate">
                          {tx.borrowerName}
                        </p>
                        <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5 truncate">
                          <span className="font-mono text-zinc-400 flex items-center gap-1">
                            <CreditCard size={11} className="text-zinc-500" />
                            {tx.loanCode || "Loan File"}
                          </span>
                          {tx.loanPrincipal && (
                            <span className="hidden md:inline font-mono text-zinc-500">
                              • ₹{fmt(tx.loanPrincipal)} Principal
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-zinc-400 italic">
                          Unallocated Received Advance
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Held in capital reserves
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Gold Monospace Currency & Status Badge */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm sm:text-base font-mono font-bold text-yellow-500">
                      ₹{fmt(displayAmount)}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      <TransactionStatusBadge tx={tx} />
                    </div>
                  </div>

                  {tx.loanId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/loan-management?loanId=${tx.loanId}`);
                      }}
                      className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-300 bg-zinc-800/60 border border-zinc-700/60 hover:border-yellow-500/40 hover:text-yellow-400 transition"
                      title="Open Loan Details"
                    >
                      <span>Loan</span>
                      <ExternalLink size={10} />
                    </button>
                  )}

                  <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 hidden sm:block" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
