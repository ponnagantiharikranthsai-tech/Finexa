"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getApplicationsAction } from "@/features/applications/actions/get-applications.action";
import { ApplicationsList } from "@/features/applications/components/applications-list";
import { RefreshCw } from "lucide-react";

export default function ApplicationsPage() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["applications-data"],
    queryFn: async () => {
      const res = await getApplicationsAction({});
      if (!res.success) {
        throw new Error(typeof res.error === "string" ? res.error : "Failed to fetch applications");
      }
      return res.data;
    },
    staleTime: 1000 * 60 * 3,
  });

  const apps = data ? data.data : [];
  const total = data ? data.pagination.total : 0;
  const totalPages = data ? data.pagination.totalPages : 0;

  return (
    <div className="space-y-6 text-left">
      {/* Link Generator Header Branding */}
      <div className="flex flex-col items-start gap-3 p-6 rounded-2xl fx-glass-card relative">
        <div className="flex items-center justify-between w-full">
          <img 
            src="/logo-icon.png" 
            alt="Finexa Logo" 
            className="h-10 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
          />
          {isFetching && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary animate-pulse select-none">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
        </div>
        <h1 className="text-lg font-black tracking-wider text-foreground uppercase mt-1">
          FINEXA Smart Loan Management
        </h1>
        
        {/* Professional Gold Divider */}
        <div className="h-[2px] bg-primary w-full my-1 opacity-50 shadow-[0_0_8px_rgba(184,134,11,0.25)]" />
        
        <p className="text-xs text-muted-foreground">
          Generate secure loan application links for borrowers and verify submitted profiles.
        </p>
      </div>

      {isLoading && !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Loading applications...</p>
        </div>
      ) : (
        <ApplicationsList initialApps={apps} total={total} totalPages={totalPages} />
      )}
    </div>
  );
}
