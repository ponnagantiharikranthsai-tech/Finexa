import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark } from "lucide-react";

export default function CapitalManagementLoading() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Landmark className="h-5 w-5 text-primary/40" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-3.5 w-72 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      {/* Capital Summary Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-5 rounded-2xl border border-border/40 bg-card/50 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        ))}
      </div>

      {/* Funders Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-5 rounded-2xl border border-border/50 bg-card/60 space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="space-y-2 border-t border-border/30 pt-3">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
