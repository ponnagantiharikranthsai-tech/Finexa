import React from "react";

export default function NotificationsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-5">
        <div className="space-y-2">
          <div className="h-8 w-60 bg-muted/60 rounded-xl" />
          <div className="h-4 w-72 bg-muted/40 rounded-lg" />
        </div>
      </div>

      <div className="h-12 w-full bg-muted/50 rounded-xl border border-border/40" />

      <div className="space-y-4 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border/60 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-5 w-48 bg-muted/70 rounded-lg" />
              <div className="h-6 w-20 bg-muted/50 rounded-full" />
            </div>
            <div className="h-10 bg-muted/30 rounded-xl border border-border/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
