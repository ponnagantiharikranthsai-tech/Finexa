import React from "react";

export default function ReportsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-5">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-muted/60 rounded-xl" />
          <div className="h-4 w-72 bg-muted/40 rounded-lg" />
        </div>
        <div className="h-10 w-48 bg-muted/60 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border/60 space-y-3">
            <div className="h-3.5 w-28 bg-muted/60 rounded" />
            <div className="h-7 w-32 bg-muted/80 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="h-72 bg-card rounded-2xl border border-border/60 p-6" />
    </div>
  );
}
