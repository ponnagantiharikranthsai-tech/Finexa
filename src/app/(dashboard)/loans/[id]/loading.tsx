import React from "react";
import { CreditCard } from "lucide-react";
import { SkeletonCard, SkeletonAvatar, SkeletonTableRow, SkeletonButton, Skeleton } from "@/components/ui/skeleton";

export default function SingleLoanLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <SkeletonAvatar size="md" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        </div>
        <SkeletonButton className="h-10 w-28" />
      </div>

      {/* Hero Summary Card */}
      <SkeletonCard className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-black/15">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2.5 w-20 rounded" />
              <Skeleton className="h-6 w-28 rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Payment History Table Skeleton */}
      <SkeletonCard className="p-6 space-y-4">
        <Skeleton className="h-5 w-40 rounded-md" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <SkeletonTableRow key={i} />
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
