import React from "react";
import { BarChart3 } from "lucide-react";
import { ReportCardSkeleton, SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Business performance metrics, total capital returns, and interest analytics.
          </p>
        </div>
      </div>

      {/* KPI Stats Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <ReportCardSkeleton key={i} />
        ))}
      </div>

      {/* Main Chart Container Skeleton */}
      <SkeletonCard className="p-6 h-80 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <div className="flex items-end justify-between gap-3 h-48 pt-4">
          {[40, 65, 30, 85, 55, 70, 95, 60, 45, 80, 50, 75].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
