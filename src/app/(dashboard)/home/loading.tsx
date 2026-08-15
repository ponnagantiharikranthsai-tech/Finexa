import React from "react";

export default function HomeLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-5">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted/60 rounded-xl" />
          <div className="h-4 w-64 bg-muted/40 rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-muted/60 rounded-xl" />
      </div>

      {/* KPI Stats skeleton grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border/60 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-24 bg-muted/60 rounded" />
              <div className="h-8 w-8 bg-muted/50 rounded-xl" />
            </div>
            <div className="h-7 w-32 bg-muted/80 rounded-lg" />
            <div className="h-3 w-20 bg-muted/40 rounded" />
          </div>
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid lg:grid-cols-3 gap-6 pt-2">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border/60 space-y-4">
          <div className="h-5 w-40 bg-muted/70 rounded-lg" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-muted/30 rounded-xl border border-border/40" />
            ))}
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border/60 space-y-4">
          <div className="h-5 w-32 bg-muted/70 rounded-lg" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-xl border border-border/40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
