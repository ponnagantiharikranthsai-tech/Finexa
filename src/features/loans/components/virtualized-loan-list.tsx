"use client";

import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LoanManagementDetailResult } from "../actions/get-loan-management-data.action";
import { CreditCard, ChevronRight } from "lucide-react";

export interface VirtualizedLoanListProps {
  loans: LoanManagementDetailResult[];
  onSelectLoan: (loan: LoanManagementDetailResult) => void;
}

export function VirtualizedLoanList({ loans, onSelectLoan }: VirtualizedLoanListProps) {
  // 1. Parent scroll container reference
  const parentRef = useRef<HTMLDivElement>(null);

  // 2. Initialize list virtualizer
  const rowVirtualizer = useVirtualizer({
    count: loans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated height of each row/card in pixels
    overscan: 5, // Extra buffer rows rendered above/below viewport
  });

  if (loans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center fx-glass-card rounded-[22px] border border-border">
        <div className="h-14 w-14 bg-secondary rounded-2xl flex items-center justify-center mb-4 border border-border">
          <CreditCard className="h-7 w-7 text-primary" />
        </div>
        <p className="font-bold text-foreground">No records matched</p>
        <p className="text-xs text-muted-foreground mt-1 mb-5">Try checking your search inputs or filter toggles.</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-280px)] min-h-[400px] w-full overflow-y-auto rounded-2xl border border-zinc-800 bg-[#121215] p-2"
    >
      {/* Container holding the total calculated height of all items combined */}
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {/* Render only visible virtual items mapped to absolute positioning */}
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const loan = loans[virtualRow.index];
          const loanId = loan.loanId || (loan as any).id;
          const borrowerName = loan.borrower?.name || (loan as any).borrowerName || "Unknown Borrower";
          const principal = Number(loan.principal || (loan as any).amount || 0);
          const loanType = loan.interestType
            ? `${loan.interestType.charAt(0).toUpperCase() + loan.interestType.slice(1)} Interest`
            : (loan as any).loanType || "Personal Loan";

          const isOverdue = loan.status === "overdue" || (new Date(loan.dueDate) < new Date() && loan.outstandingBalance > 0);
          const isSettled = loan.outstandingBalance <= 0 || loan.status === "closed";

          const statusColor = isSettled
            ? "text-zinc-400 bg-zinc-800/80 border-zinc-700/50"
            : isOverdue
            ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
            : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

          return (
            <div
              key={virtualRow.key}
              onClick={() => onSelectLoan(loan)}
              className="absolute left-0 top-0 w-full transition-transform"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="mx-2 flex h-[64px] items-center justify-between rounded-xl border border-zinc-800/80 bg-[#18181b] px-4 hover:border-yellow-500/40 hover:bg-[#202024] cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-zinc-400 group-hover:text-amber-400 transition-colors">
                    #{loanId?.toString().slice(-4)}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
                      {borrowerName}
                    </p>
                    <p className="text-xs text-zinc-400">{loanType}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-yellow-500">
                      ₹{principal.toLocaleString("en-IN")}
                    </p>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                      {isSettled ? "Settled" : isOverdue ? "Overdue" : loan.status}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
