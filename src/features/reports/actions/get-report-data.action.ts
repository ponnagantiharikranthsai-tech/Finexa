"use server";

import { reportRepository } from "../repository/report.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult, PaginatedResult } from "@/types/api.types";

export async function getReportDataAction(
  reportType: "overdue" | "outstanding" | "interest_earned" | "closed_history",
  page: number = 1,
  pageSize: number = 20,
  dateFrom?: string,
  dateTo?: string
): Promise<ActionResult<PaginatedResult<any>>> {
  try {
    await requireAuth();

    if (reportType === "overdue") {
      const result = await reportRepository.getOverdueLoans(page, pageSize);
      return { success: true, data: result };
    }

    if (reportType === "outstanding") {
      const result = await reportRepository.getOutstandingBalances(page, pageSize);
      return { success: true, data: result };
    }

    if (reportType === "interest_earned") {
      if (!dateFrom || !dateTo) {
        return { success: false, error: "Date range (From and To) is required for Interest Earned report." };
      }
      const result = await reportRepository.getInterestEarned(dateFrom, dateTo, page, pageSize);
      return { success: true, data: result };
    }

    if (reportType === "closed_history") {
      if (!dateFrom || !dateTo) {
        return { success: false, error: "Date range (From and To) is required for Closed Loan History report." };
      }
      const result = await reportRepository.getClosedLoans(dateFrom, dateTo, page, pageSize);
      return { success: true, data: result };
    }

    return { success: false, error: "Invalid report type" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch report data" };
  }
}
