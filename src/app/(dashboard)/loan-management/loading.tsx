import React from "react";
import { CreditCard } from "lucide-react";
import { LoanCardSkeleton, SkeletonInput, SkeletonButton } from "@/components/ui/skeleton";

export default function LoanManagementLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified borrower details, KYC, and loan portfolio management.
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar Skeleton */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <SkeletonInput className="h-11" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonButton className="h-11 w-36" />
          <SkeletonButton className="h-11 w-44" />
          <SkeletonButton className="h-11 w-52" />
          <SkeletonButton className="h-11 w-32" />
        </div>
      </div>

      {/* Cards Grid Skeleton */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <LoanCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
