import React from "react";
import { Bell } from "lucide-react";
import { NotificationCardSkeleton, SkeletonButton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Payment Notifications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated payment reminders, overdue loan alerts, and customer notifications.
          </p>
        </div>
      </div>

      {/* Tabs & Mark All Read Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <SkeletonButton className="h-9 w-20 rounded-full" />
          <SkeletonButton className="h-9 w-24 rounded-full" />
          <SkeletonButton className="h-9 w-24 rounded-full" />
        </div>
        <SkeletonButton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Notifications List Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <NotificationCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
