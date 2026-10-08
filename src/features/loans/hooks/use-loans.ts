"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLoanManagementData, LOANS_QUERY_KEY } from "./use-loan-management-data";
import type { LoanManagementDetailResult } from "../actions/get-loan-management-data.action";

export { useLoanManagementData, LOANS_QUERY_KEY };
export type { LoanManagementDetailResult };

/**
 * Unified lightweight wrapper hook around Finexa's TanStack Query + IndexedDB loan data layer.
 * 
 * Benefits:
 * - 0 ms immediate reads from IndexedDB cache
 * - 3-minute staleTime background sync
 * - Type-safe integration with Server Actions
 */
export function useLoans(initialData?: LoanManagementDetailResult[]) {
  const {
    loans,
    isLoading,
    isBackgroundSyncing,
    error,
    refreshLoans,
    updateLoanOptimistic,
  } = useLoanManagementData(initialData);

  return {
    loans,
    isLoading,
    isError: !!error,
    error,
    refreshLoans,
    isBackgroundSyncing,
    updateLoanOptimistic,
  };
}

/**
 * Helper hook for instantaneous optimistic loan mutations with cancellation and rollback snapshot.
 */
export function useOptimisticLoanUpdate() {
  const queryClient = useQueryClient();

  const updateLoanOptimistically = async (
    updatedLoan: ({ loanId: string } | { id: string }) & Partial<LoanManagementDetailResult>
  ) => {
    const targetId = "loanId" in updatedLoan ? updatedLoan.loanId : updatedLoan.id;

    // 1. Cancel ongoing background refetches so they don't overwrite optimistic data
    await queryClient.cancelQueries({ queryKey: LOANS_QUERY_KEY });

    // 2. Snapshot current state for rollback on error
    const previousLoans = queryClient.getQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY);

    // 3. Update query cache instantly
    queryClient.setQueryData<LoanManagementDetailResult[]>(LOANS_QUERY_KEY, (oldData) => {
      if (!oldData) return [];
      return oldData.map((loan) =>
        loan.loanId === targetId ? { ...loan, ...updatedLoan } : loan
      );
    });

    const rollback = () => {
      if (previousLoans) {
        queryClient.setQueryData(LOANS_QUERY_KEY, previousLoans);
      }
    };

    return { previousLoans, rollback };
  };

  return { updateLoanOptimistically };
}
