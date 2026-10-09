"use client";

import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ApplicationWithBorrower } from "../repository/application.repository";
import { FileText, ChevronRight, Phone, Calendar, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export interface VirtualizedApplicationsQueueProps {
  applications: ApplicationWithBorrower[];
  onSelectApplication: (application: ApplicationWithBorrower) => void;
  maxHeight?: string;
}

/**
 * Status badge with dark glassmorphic styling and crisp color accents
 */
function QueueStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 shadow-sm shadow-emerald-950/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Approved
        </span>
      );
    case "pending_verification":
    case "submitted":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Pending Review
        </span>
      );
    case "active":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          Active Link
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
          Rejected
        </span>
      );
    case "expired":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700/50 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Expired
        </span>
      );
  }
}

/**
 * VirtualizedApplicationsQueue
 * High-performance virtualized feed for loan applications queue with dark glassmorphism aesthetic.
 */
export function VirtualizedApplicationsQueue({
  applications,
  onSelectApplication,
  maxHeight = "calc(100vh - 280px)",
}: VirtualizedApplicationsQueueProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Initialize row virtualizer with ~90px card height
  const rowVirtualizer = useVirtualizer({
    count: applications.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 6,
  });

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-zinc-800/80 bg-[#121215] px-4 shadow-xl">
        <div className="h-14 w-14 rounded-2xl bg-[#18181b] border border-zinc-800/80 flex items-center justify-center mb-4 text-zinc-400 shadow-inner">
          <FileText className="h-7 w-7 text-amber-400/80" />
        </div>
        <p className="font-semibold text-zinc-100 text-sm">No applications in queue</p>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm">
          No active or pending loan applications matched your filter criteria.
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
      {/* Virtual scroll container */}
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const app = applications[virtualRow.index];
          const borrowerName = app.borrower?.name || app.customerName;
          const borrowerMobile = app.borrower?.mobile || app.customerMobile;
          const principalNum = Number(app.principal || 0);
          const interestNum = Number(app.interestAmount || 0);

          const formattedCreatedDate = app.createdAt
            ? new Date(app.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : null;

          const formattedExpiry = app.expiryDate
            ? new Date(app.expiryDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })
            : null;

          return (
            <div
              key={virtualRow.key}
              onClick={() => onSelectApplication(app)}
              className="absolute left-0 top-0 w-full transition-transform"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="group mx-1 mb-2.5 flex h-[82px] items-center justify-between rounded-xl border border-zinc-800/80 bg-[#18181b] px-4 py-2.5 cursor-pointer transition-all duration-200 hover:border-yellow-500/40 hover:bg-[#202024] hover:shadow-lg hover:shadow-black/40">
                {/* Left: Code, Customer identity, and metadata */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-semibold text-zinc-400 group-hover:text-amber-400 transition-colors">
                      {app.applicationCode}
                    </span>
                    {app.loanDuration && (
                      <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {app.loanDuration}
                      </span>
                    )}
                  </div>

                  <div className="h-8 w-px bg-zinc-800/80 hidden sm:block" />

                  <div className="min-w-0 flex-1">
                    {borrowerName ? (
                      <div>
                        <p className="text-sm font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors truncate">
                          {borrowerName}
                        </p>
                        <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                          {borrowerMobile && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3 text-zinc-500 shrink-0" />
                              {borrowerMobile}
                            </span>
                          )}
                          {formattedCreatedDate && (
                            <span className="hidden md:inline-flex items-center gap-1 text-zinc-500">
                              • <Calendar className="h-3 w-3 shrink-0" /> {formattedCreatedDate}
                            </span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-zinc-400 italic">
                          Link Shared / Unsubmitted
                        </p>
                        {formattedExpiry && (
                          <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 shrink-0" /> Expires {formattedExpiry}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Currency amount, Status badge, and Chevron */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm sm:text-base font-mono font-bold text-yellow-500">
                      ₹{principalNum.toLocaleString("en-IN")}
                    </p>
                    <div className="mt-1 flex items-center justify-end">
                      <QueueStatusBadge status={app.status} />
                    </div>
                  </div>

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
