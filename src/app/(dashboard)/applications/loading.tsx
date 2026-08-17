import React from "react";
import { ClipboardList } from "lucide-react";
import { ApplicationCardSkeleton, SkeletonButton } from "@/components/ui/skeleton";

export default function ApplicationsLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loan Applications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review customer self-application requests and verify KYC documents.
          </p>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        <SkeletonButton className="h-9 w-24 rounded-full" />
        <SkeletonButton className="h-9 w-28 rounded-full" />
        <SkeletonButton className="h-9 w-24 rounded-full" />
      </div>

      {/* Applications List Skeleton */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <ApplicationCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
