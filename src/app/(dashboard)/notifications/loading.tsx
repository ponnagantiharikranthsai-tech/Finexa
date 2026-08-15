import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell } from "lucide-react";

export default function NotificationsLoading() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary/40" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-3.5 w-72 rounded-md" />
        </div>
      </div>

      {/* Pill Filter Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Skeleton className="h-11 w-20 rounded-full shrink-0" />
        <Skeleton className="h-11 w-24 rounded-full shrink-0" />
        <Skeleton className="h-11 w-24 rounded-full shrink-0" />
        <Skeleton className="h-11 w-28 rounded-full shrink-0" />
        <Skeleton className="h-11 w-24 rounded-full shrink-0" />
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border/40 bg-card/60 space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <Skeleton className="h-4.5 w-48 rounded" />
                <Skeleton className="h-3.5 w-32 rounded" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full rounded" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 w-32 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
