"use server";

import { loanRepository, type DashboardStats } from "@/features/loans/repository/loan.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function getDashboardStatsAction(): Promise<ActionResult<DashboardStats>> {
  try {
    await requireAuth();
    const stats = await loanRepository.getDashboardStats();
    return { success: true, data: stats };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch dashboard stats" };
  }
}
