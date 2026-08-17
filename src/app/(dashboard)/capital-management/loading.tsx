import React from "react";
import { Landmark } from "lucide-react";
import { CapitalFunderSkeleton, SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function CapitalManagementLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Landmark className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Capital Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track multi-funder investments, capital returns, and interest share allocations.
          </p>
        </div>
      </div>

      {/* Hero Stats Banner Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="p-4 space-y-2">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="h-2.5 w-20 rounded" />
          </SkeletonCard>
        ))}
      </div>

      {/* Funders Grid Skeleton */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <CapitalFunderSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
