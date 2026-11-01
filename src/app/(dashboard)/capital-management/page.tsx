"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getCapitalDataAction } from "@/features/capital/actions/get-capital-data.action";
import { CapitalManagementList } from "@/features/capital/components/capital-management-list";
import { Coins, RefreshCw } from "lucide-react";
import CapitalManagementLoading from "./loading";

export default function CapitalManagementPage() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["capital-management-data-v2"],
    queryFn: async () => {
      const res = await getCapitalDataAction();
      if (!res.success || !res.data) {
        throw new Error(typeof res.error === "string" ? res.error : "Failed to fetch capital data");
      }
      return res.data;
    },
    staleTime: 1000 * 60 * 5,       // 5 min: keep fresh in memory
    gcTime:    1000 * 60 * 60 * 24, // 24 hours: keep in memory
    refetchOnWindowFocus: false,
  });

  const fallbackData = {
    funders: [],
    stats: {
      totalReceived: 0,
      totalProvided: 0,
      currentlyAllocated: 0,
      unallocatedReceived: 0,
      totalReturned: 0,
      activeCapital: 0,
      availableCapital: 0,
      activeFunders: 0,
      totalOutstandingLoansPrincipal: 0,
    },
  };

  if (isLoading && !data) {
    return <CapitalManagementLoading />;
  }

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
              Track on-demand capital partners, individual funding transactions, and loan allocations.
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

      <CapitalManagementList initialData={data || fallbackData} />
    </div>
  );
}
