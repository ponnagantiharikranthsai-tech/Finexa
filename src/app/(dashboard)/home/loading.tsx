import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-10 relative overflow-hidden bg-background">
      {/* Central Hero Logo Skeleton */}
      <div className="flex flex-col items-center justify-center text-center pb-12 w-full">
        <div className="mb-6 w-[280px] sm:w-[380px] px-6 h-16 flex items-center justify-center">
          <Skeleton className="h-14 w-64 sm:w-80 rounded-2xl" />
        </div>
        <Skeleton className="h-4 w-48 rounded-md" />
      </div>

      {/* 3D Nav Cards Grid Skeleton */}
      <div className="w-full max-w-4xl px-6 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="p-6 rounded-[20px] border border-border/40 bg-card/60 fx-glass-card text-left flex flex-col justify-between h-48"
            >
              <div className="flex items-start justify-between">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              <div className="space-y-2 mt-auto">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-4/5 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
