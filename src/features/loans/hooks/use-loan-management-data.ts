"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLoanManagementDataAction } from "../actions/get-loan-management-data.action";
import type { LoanManagementDetailResult } from "../actions/get-loan-management-data.action";

export const LOANS_QUERY_KEY = ["loan-management-data"];

export function useLoanManagementData(initialData?: LoanManagementDetailResult[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LOANS_QUERY_KEY,
    queryFn: async () => {
      const res = await getLoanManagementDataAction();
      if (!res.success) {
        const errorMsg = typeof res.error === "string" ? res.error : "Failed to fetch loan data";
        throw new Error(errorMsg);
      }
      return res.data;
    },
    // Seed with SSR data if provided, otherwise TanStack Query reads immediately from IndexedDB
    initialData: initialData && initialData.length > 0 ? initialData : undefined,
    staleTime: 1000 * 60 * 3, // 3 minutes fresh cache window
  });

  // Optimistically update a single loan card locally without waiting for server roundtrip
  const updateLoanOptimistic = (
    loanId: string,
    updates: Partial<LoanManagementDetailResult>
  ) => {
    queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (old) => {
      if (!old) return [];
      return old.map((loan) =>
        loan.loanId === loanId ? { ...loan, ...updates } : loan
      );
    });
  };

  // Invalidate and refresh cache in background
  const refreshLoans = async () => {
    await queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
  };

  return {
    loans: query.data || [],
    isLoading: query.isLoading && !query.data, // True ONLY on first-ever install with empty cache
    isBackgroundSyncing: query.isFetching,      // True when revalidating in background
    error: query.error,
    refreshLoans,
    updateLoanOptimistic,
  };
}
