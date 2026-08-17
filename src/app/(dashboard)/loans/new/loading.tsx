import React from "react";
import { PlusCircle } from "lucide-react";
import { SkeletonCard, SkeletonInput, SkeletonButton, Skeleton } from "@/components/ui/skeleton";

export default function NewLoanLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <PlusCircle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Register New Loan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create a loan record, set repayment frequency, and attach borrower.
          </p>
        </div>
      </div>

      {/* Form Skeleton Card */}
      <SkeletonCard className="p-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28 rounded" />
          <SkeletonInput className="h-11" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <SkeletonInput className="h-11" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded" />
            <SkeletonInput className="h-11" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded" />
            <SkeletonInput className="h-11" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <SkeletonInput className="h-11" />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-border/30">
          <SkeletonButton className="h-11 w-24" />
          <SkeletonButton className="h-11 w-40" />
        </div>
      </SkeletonCard>
    </div>
  );
}
