import React from "react";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { ArrowLeft, Landmark } from "lucide-react";

export default function CapitalLedgerLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Back button skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-44 rounded-lg bg-muted/40 animate-pulse" />
      </div>

      {/* Header Banner Skeleton */}
      <div className="rounded-[22px] border border-border/50 bg-card/60 p-5 space-y-3">
        <div className="h-7 w-64 bg-muted/50 rounded-lg animate-pulse" />
        <div className="flex gap-4">
          <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-28 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>

      {/* 4 Summary Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="p-4 space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-2 w-32 rounded" />
          </SkeletonCard>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-4 space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
