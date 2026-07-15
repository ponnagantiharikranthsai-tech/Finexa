"use server";

import { loanRepository, type LoanFilters } from "../repository/loan.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult, PaginatedResult } from "@/types/api.types";
import type { LoanWithBorrower } from "../repository/loan.repository";

export async function getLoansAction(
  filters: LoanFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<ActionResult<PaginatedResult<LoanWithBorrower>>> {
  try {
    await requireAuth();
    const result = await loanRepository.findMany(filters, { page, pageSize });
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch loans" };
  }
}
