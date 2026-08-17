import React from "react";
import { cn } from "@/lib/utils";

// Base Skeleton Primitive
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("fx-skeleton rounded-lg", className)}
      {...props}
    />
  );
}

// Text Block Skeleton
export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className="space-y-2 w-full">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4 w-full rounded-md",
            i === lines - 1 && lines > 1 ? "w-3/4" : "",
            className
          )}
        />
      ))}
    </div>
  );
}

// Circle Avatar Skeleton
export function SkeletonAvatar({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };
  return <Skeleton className={cn("rounded-xl shrink-0", sizeMap[size], className)} />;
}

// Card Container Skeleton
export function SkeletonCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-border/40 p-5 bg-card/60 fx-glass-card space-y-4 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

// Button Skeleton
export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-28 rounded-xl", className)} />;
}

// Input Skeleton
export function SkeletonInput({ className }: { className?: string }) {
  return <Skeleton className={cn("h-11 w-full rounded-xl", className)} />;
}

// Table Row Skeleton
export function SkeletonTableRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between p-4 border-b border-border/30 gap-4", className)}>
      <SkeletonAvatar size="sm" />
      <SkeletonText className="h-4 flex-1" />
      <Skeleton className="h-4 w-20 rounded" />
      <Skeleton className="h-4 w-16 rounded" />
    </div>
  );
}

// ── Specialized Domain Skeletons ──────────────────────────────────────────────

// Loan Card Skeleton (Matches 1:1 LoanManagement card layout)
export function LoanCardSkeleton() {
  return (
    <SkeletonCard className="flex flex-col justify-between h-full min-h-[260px]">
      <div className="space-y-4">
        {/* Header Profile + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SkeletonAvatar size="md" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        {/* Loan Details Grid */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-white/[0.02] bg-black/15">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </div>

        {/* Due Date Row */}
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t border-border/30">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 flex-1 rounded-xl" />
      </div>
    </SkeletonCard>
  );
}

// Borrower Card Skeleton (Matches 1:1 Borrowers list card)
export function BorrowerCardSkeleton() {
  return (
    <SkeletonCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SkeletonAvatar size="lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>

      <div className="space-y-2 pt-2 border-t border-border/30">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/30">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
    </SkeletonCard>
  );
}

// Application Card Skeleton
export function ApplicationCardSkeleton() {
  return (
    <SkeletonCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-3 w-28 rounded-md" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-black/15">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-16 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-16 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </SkeletonCard>
  );
}

// Capital Funder Skeleton
export function CapitalFunderSkeleton() {
  return (
    <SkeletonCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SkeletonAvatar size="md" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-black/15 text-center">
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
      </div>
    </SkeletonCard>
  );
}

// Report Card Skeleton
export function ReportCardSkeleton() {
  return (
    <SkeletonCard className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-36 rounded-md" />
      <Skeleton className="h-2.5 w-28 rounded" />
    </SkeletonCard>
  );
}

// Notification Card Skeleton
export function NotificationCardSkeleton() {
  return (
    <div className="p-4 rounded-2xl border border-border/40 bg-card/60 fx-glass-card flex items-start gap-3">
      <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}
