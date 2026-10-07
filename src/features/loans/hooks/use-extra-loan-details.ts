"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getExtraLoanDetailsAction, type ExtraLoanDetails } from "../actions/get-extra-loan-details.action";
import { getPenaltyLedgerAction } from "../actions/get-penalty-ledger.action";
import type { PenaltyLedger } from "@/db/schema";

export interface ExtraLoanDataResult {
  extraDetails: ExtraLoanDetails;
  penaltyLedger: PenaltyLedger[];
}

export function useExtraLoanDetails(loanId: string | null | undefined) {
  const query = useQuery<ExtraLoanDataResult | null>({
    queryKey: ["loan-details", loanId],
    queryFn: async () => {
      if (!loanId) return null;
      const [extraRes, ledgerRes] = await Promise.all([
        getExtraLoanDetailsAction(loanId),
        getPenaltyLedgerAction(loanId),
      ]);

      if (!extraRes.success) {
        const err = extraRes.error;
        throw new Error(typeof err === "string" ? err : "Failed to load audit file details.");
      }

      return {
        extraDetails: extraRes.data,
        penaltyLedger: ledgerRes.success && ledgerRes.data ? ledgerRes.data : [],
      };
    },
    enabled: Boolean(loanId),
    staleTime: 1000 * 60 * 5, // 5 minutes fresh cache window for instant 0ms access
  });

  return {
    data: query.data,
    extraDetails: query.data?.extraDetails ?? null,
    penaltyLedger: query.data?.penaltyLedger ?? [],
    isLoading: query.isLoading && query.fetchStatus !== "idle",
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useInvalidateLoanDetails() {
  const queryClient = useQueryClient();
  return (loanId?: string) => {
    if (loanId) {
      queryClient.invalidateQueries({ queryKey: ["loan-details", loanId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["loan-details"] });
    }
  };
}
