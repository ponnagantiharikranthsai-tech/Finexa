"use client";

import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FunderWithReturns } from "../actions/get-capital-data.action";
import { Users, ChevronRight, Phone, Landmark, CheckCircle2, Clock } from "lucide-react";

export interface VirtualizedFundersQueueProps {
  funders: FunderWithReturns[];
  onSelectFunder: (funder: FunderWithReturns) => void;
  maxHeight?: string;
}

const fmt = (val: number | string | undefined | null) => (Number(val) || 0).toLocaleString("en-IN");

function FunderStatusBadge({ funder }: { funder: FunderWithReturns }) {
  const isSettled = funder.status === "settled" || (funder.currentlyAllocated === 0 && funder.capitalPayable === 0 && funder.totalProvided > 0);
  const isPartiallyReturned = funder.capitalPayable > 0;

  if (isSettled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
        <CheckCircle2 size={10} /> Settled
      </span>
    );
  }

  if (isPartiallyReturned) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
        <Clock size={10} /> Partially Returned
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
      Active Partner
    </span>
  );
}

/**
 * VirtualizedFundersQueue
 * 60 FPS Virtualized Capital Partners & Investors Feed
 */
export function VirtualizedFundersQueue({
  funders,
  onSelectFunder,
  maxHeight = "calc(100vh - 300px)",
}: VirtualizedFundersQueueProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: funders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 6,
  });

  if (funders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-zinc-800/80 bg-[#121215] px-4 shadow-xl">
        <div className="h-14 w-14 rounded-2xl bg-[#18181b] border border-zinc-800/80 flex items-center justify-center mb-4 text-zinc-400 shadow-inner">
          <Users className="h-7 w-7 text-amber-400/80" />
        </div>
        <p className="font-semibold text-zinc-100 text-sm">No capital partners found</p>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm">
          No records matched your search filters or status criteria.
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
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const funder = funders[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              onClick={() => onSelectFunder(funder)}
              className="absolute left-0 top-0 w-full transition-transform"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="group mx-1 mb-2.5 flex h-[82px] items-center justify-between rounded-xl border border-zinc-800/80 bg-[#18181b] px-4 py-2.5 cursor-pointer transition-all duration-200 hover:border-yellow-500/40 hover:bg-[#202024] hover:shadow-lg hover:shadow-black/40">
                {/* Left: Partner identity & metrics summary */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors truncate">
                      {funder.name}
                    </p>
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                      {funder.mobile && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3 text-zinc-500 shrink-0" />
                          {funder.mobile}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="h-8 w-px bg-zinc-800/80 hidden sm:block shrink-0" />

                  {/* Micro metric badges */}
                  <div className="hidden md:flex items-center gap-3 text-xs">
                    <div className="bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Allocated</span>
                      <span className="font-mono font-semibold text-zinc-200">₹{fmt(funder.currentlyAllocated)}</span>
                    </div>
                    {funder.unallocatedReceived > 0 && (
                      <div className="bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-800/60">
                        <span className="text-[10px] text-sky-400 uppercase tracking-wider block">Reserve</span>
                        <span className="font-mono font-semibold text-sky-300">₹{fmt(funder.unallocatedReceived)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Total Provided (Gold Monospace) and Status */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm sm:text-base font-mono font-bold text-yellow-500">
                      ₹{fmt(funder.totalProvided)}
                    </p>
                    <div className="mt-1 flex items-center justify-end">
                      <FunderStatusBadge funder={funder} />
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
