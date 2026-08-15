import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5 text-primary/40" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-32 rounded-lg" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border/40 bg-card/50 space-y-3">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-7 w-32 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Chart Section */}
      <div className="p-6 rounded-2xl border border-border/40 bg-card/60 space-y-4">
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
