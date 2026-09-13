"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getCapitalDataAction } from "@/features/capital/actions/get-capital-data.action";
import { CapitalManagementList } from "@/features/capital/components/capital-management-list";
import { Coins, RefreshCw } from "lucide-react";

export default function CapitalManagementPage() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["capital-management-data"],
    queryFn: async () => {
      const res = await getCapitalDataAction();
      if (!res.success || !res.data) {
        throw new Error(typeof res.error === "string" ? res.error : "Failed to fetch capital data");
      }
      return res.data;
    },
    staleTime: 1000 * 60 * 3,
  });

  const fallbackData = {
    funders: [],
    stats: {
      totalReceived: 0,
      totalReturned: 0,
      activeCapital: 0,
      availableCapital: 0,
      activeFunders: 0,
      totalOutstandingLoansPrincipal: 0,
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-left">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Capital</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track funder investments, capital returns, and capital summary stats.
            </p>
          </div>
        </div>

        {/* Sync Badge */}
        {isFetching && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary animate-pulse select-none">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Syncing...</span>
          </div>
        )}
      </div>

      {isLoading && !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Loading capital data...</p>
        </div>
      ) : (
        <CapitalManagementList initialData={data || fallbackData} />
      )}
    </div>
  );
}
