import React from "react";
import { SkeletonCard, SkeletonAvatar, SkeletonTableRow, SkeletonButton, Skeleton } from "@/components/ui/skeleton";

export default function SingleBorrowerLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Profile Header Skeleton */}
      <SkeletonCard className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <SkeletonAvatar size="lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-52 rounded-md" />
            <Skeleton className="h-3.5 w-36 rounded-md" />
          </div>
          <SkeletonButton className="h-10 w-28" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/30">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2.5 w-16 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Associated Loans Portfolio Skeleton */}
      <SkeletonCard className="p-6 space-y-4">
        <Skeleton className="h-5 w-44 rounded-md" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <SkeletonTableRow key={i} />
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
