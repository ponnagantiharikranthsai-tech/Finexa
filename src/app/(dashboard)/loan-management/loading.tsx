import React from "react";

export default function LoanManagementLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-5">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-muted/60 rounded-xl" />
          <div className="h-4 w-72 bg-muted/40 rounded-lg" />
        </div>
        <div className="h-11 w-36 bg-muted/60 rounded-xl" />
      </div>

      {/* Filter & Search Bar skeleton */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="h-11 flex-1 bg-muted/50 rounded-xl border border-border/40" />
        <div className="h-11 w-40 bg-muted/50 rounded-xl border border-border/40" />
      </div>

      {/* Loan Cards Skeleton Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border/60 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-5 w-36 bg-muted/70 rounded-lg" />
                <div className="h-3.5 w-24 bg-muted/40 rounded" />
              </div>
              <div className="h-6 w-20 bg-muted/50 rounded-full" />
            </div>
            <div className="space-y-2 border-y border-border/40 py-3">
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-muted/40 rounded" />
                <div className="h-3 w-16 bg-muted/60 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-24 bg-muted/40 rounded" />
                <div className="h-3 w-20 bg-muted/60 rounded" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 flex-1 bg-muted/60 rounded-xl" />
              <div className="h-9 flex-1 bg-muted/40 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
