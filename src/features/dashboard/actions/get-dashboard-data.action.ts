"use server";

import { loanRepository, type LoanWithBorrower } from "@/features/loans/repository/loan.repository";
import { db } from "@/db/client";
import { auditLogTable, type AuditLog } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc } from "drizzle-orm";
import type { ActionResult } from "@/types/api.types";

export type DashboardData = {
  overdueAndUpcoming: LoanWithBorrower[];
  recentActivity: AuditLog[];
};

export async function getDashboardDataAction(): Promise<ActionResult<DashboardData>> {
  try {
    await requireAuth();

    const overdueAndUpcoming = await loanRepository.getOverdueAndUpcoming();

    const recentActivity = await db
      .select()
      .from(auditLogTable)
      .orderBy(desc(auditLogTable.timestamp))
      .limit(10);

    return {
      success: true,
      data: {
        overdueAndUpcoming,
        recentActivity,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch dashboard data" };
  }
}
