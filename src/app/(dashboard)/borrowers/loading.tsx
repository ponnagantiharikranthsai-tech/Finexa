import React from "react";
import { Users } from "lucide-react";
import { BorrowerCardSkeleton, SkeletonInput, SkeletonButton } from "@/components/ui/skeleton";

export default function BorrowersLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Borrowers Directory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage borrower profiles, contact records, and active loan associations.
          </p>
        </div>
      </div>

      {/* Search & Actions Toolbar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <SkeletonInput className="h-11" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <SkeletonButton className="h-11 w-32" />
          <SkeletonButton className="h-11 w-36" />
        </div>
      </div>

      {/* Borrower Grid Skeleton */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <BorrowerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
