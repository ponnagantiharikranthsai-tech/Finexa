import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList } from "lucide-react";

export default function ApplicationsLoading() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList className="h-5 w-5 text-primary/40" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40 rounded-lg" />
            <Skeleton className="h-3.5 w-60 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border/40 bg-card/60 flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-36 rounded" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-48 rounded" />
            </div>
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
