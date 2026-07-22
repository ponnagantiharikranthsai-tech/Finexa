"use server";

import { db } from "@/db/client";
import { loansTable, borrowersTable, paymentsTable } from "@/db/schema";
import { loanRepository } from "@/features/loans/repository/loan.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import { calculateAccruedPenalty } from "@/domain/penalty-calculator";
import { sql } from "drizzle-orm";

export type FinancialAnalyticsData = {
  summary: {
    totalLent: number;
    totalCollected: number;
    totalOutstanding: number;
    totalInterestEarned: number;
    activeLoansCount: number;
    closedLoansCount: number;
  };
  today: {
    lentToday: number;
    collectedToday: number;
    interestToday: number;
    borrowersToday: number;
    closedToday: number;
  };
  monthly: {
    lentThisMonth: number;
    collectedThisMonth: number;
    interestThisMonth: number;
    newLoansThisMonth: number;
    closedLoansThisMonth: number;
  };
  borrowers: {
    total: number;
    active: number;
    closed: number;
    overdue: number;
  };
  loans: {
    active: number;
    dueToday: number;
    overdue: number;
    closingSevenDays: number;
  };
  analytics: {
    principalGiven: number;
    principalRecovered: number;
    interestReceived: number;
    remainingPrincipal: number;
    totalExpectedCollection: number;
    netProfit: number;
  };
  penalty: {
    todaysPenaltyCollected: number;
    monthlyPenaltyCollected: number;
    totalPenaltyCollected: number;
    outstandingPenalty: number;
    borrowersWithActivePenalties: number;
    totalPenaltyIncome: number;
  };
  charts: {
    dailyLending: { date: string; amount: number }[];
    dailyCollections: { date: string; amount: number }[];
    monthlyLendingVsCollections: { month: string; lent: number; collected: number }[];
    interestOverTime: { month: string; amount: number }[];
    statusDistribution: { status: string; count: number; color: string }[];
  };
};

export async function getFinancialAnalyticsAction(
  filterType: "today" | "yesterday" | "7days" | "30days" | "thisMonth" | "lastMonth" | "custom",
  customFrom?: string,
  customTo?: string
): Promise<ActionResult<FinancialAnalyticsData>> {
  try {
    await requireAuth();

    // 1. Load all raw data from DB in parallel
    const [allLoans, allPayments, allBorrowers] = await Promise.all([
      db.select().from(loansTable),
      db.select().from(paymentsTable),
      db.select().from(borrowersTable),
    ]);

    // Calculate dates
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    const thisMonthStartStr = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
    const thisMonthEndStr = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

    const lastMonthStartStr = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0];
    const lastMonthEndStr = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0];

    // Determine range for filters
    let filterStart = "";
    let filterEnd = "";

    switch (filterType) {
      case "today":
        filterStart = todayStr;
        filterEnd = todayStr;
        break;
      case "yesterday":
        filterStart = yesterdayStr;
        filterEnd = yesterdayStr;
        break;
      case "7days":
        filterStart = sevenDaysAgoStr;
        filterEnd = todayStr;
        break;
      case "30days":
        filterStart = thirtyDaysAgoStr;
        filterEnd = todayStr;
        break;
      case "thisMonth":
        filterStart = thisMonthStartStr;
        filterEnd = thisMonthEndStr;
        break;
      case "lastMonth":
        filterStart = lastMonthStartStr;
        filterEnd = lastMonthEndStr;
        break;
      case "custom":
        filterStart = customFrom || "";
        filterEnd = customTo || "";
        break;
    }

    // ─── 1. ALL TIME SUMMARY ───
    const totalLent = allLoans.reduce((sum, l) => sum + Number(l.principal), 0);
    const totalCollected = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalInterestEarned = allPayments
      .filter((p) => p.paymentType === "interest")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPenaltiesCollected = allPayments
      .filter((p) => p.paymentType === "penalty")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const activeLoans = allLoans.filter((l) => l.status === "active" || l.status === "extended");
    const overdueLoans = allLoans.filter((l) => l.status === "overdue");
    const closedLoans = allLoans.filter((l) => l.status === "closed");

    // Outstanding collection balance in bulk
    let totalOutstanding = 0;
    const nonClosedLoans = allLoans.filter((l) => l.status !== "closed");
    const outstandingBalancesMap = await loanRepository.getOutstandingBalancesForLoans(nonClosedLoans);
    for (const loan of nonClosedLoans) {
      totalOutstanding += outstandingBalancesMap.get(loan.loanId) || 0;
    }

    // ─── 2. TODAY'S REPORT ───
    const lentToday = allLoans
      .filter((l) => l.dateGiven === todayStr)
      .reduce((sum, l) => sum + Number(l.principal), 0);
    const collectedToday = allPayments
      .filter((p) => p.paymentDate === todayStr)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const interestToday = allPayments
      .filter((p) => p.paymentDate === todayStr && p.paymentType === "interest")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const borrowersToday = allBorrowers.filter(
      (b) => b.createdAt.toISOString().split("T")[0] === todayStr
    ).length;
    const closedToday = allLoans.filter(
      (l) => l.status === "closed" && l.updatedAt.toISOString().split("T")[0] === todayStr
    ).length;

    // ─── 3. MONTHLY REPORT ───
    const lentThisMonth = allLoans
      .filter((l) => l.dateGiven >= thisMonthStartStr && l.dateGiven <= thisMonthEndStr)
      .reduce((sum, l) => sum + Number(l.principal), 0);
    const collectedThisMonth = allPayments
      .filter((p) => p.paymentDate >= thisMonthStartStr && p.paymentDate <= thisMonthEndStr)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const interestThisMonth = allPayments
      .filter(
        (p) =>
          p.paymentDate >= thisMonthStartStr &&
          p.paymentDate <= thisMonthEndStr &&
          p.paymentType === "interest"
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const newLoansThisMonth = allLoans.filter(
      (l) => l.dateGiven >= thisMonthStartStr && l.dateGiven <= thisMonthEndStr
    ).length;
    const closedLoansThisMonth = allLoans.filter(
      (l) =>
        l.status === "closed" &&
        l.updatedAt.toISOString().split("T")[0] >= thisMonthStartStr &&
        l.updatedAt.toISOString().split("T")[0] <= thisMonthEndStr
    ).length;

    // ─── 4. BORROWER STATS ───
    const totalBorrowersCount = allBorrowers.length;
    const activeBorrowersSet = new Set(nonClosedLoans.map((l) => l.borrowerId));
    const activeBorrowersCount = activeBorrowersSet.size;

    const overdueBorrowersSet = new Set(overdueLoans.map((l) => l.borrowerId));
    const overdueBorrowersCount = overdueBorrowersSet.size;

    const closedBorrowersCount = Math.max(totalBorrowersCount - activeBorrowersCount, 0);

    // ─── 5. LOAN STATUS TRIGGERS ───
    const activeCount = activeLoans.length;
    const dueTodayCount = activeLoans.filter((l) => l.dueDate === todayStr).length;
    const overdueCount = overdueLoans.length;

    const nextSevenDays = new Date();
    nextSevenDays.setDate(today.getDate() + 7);
    const nextSevenDaysStr = nextSevenDays.toISOString().split("T")[0];
    const closingSevenDaysCount = activeLoans.filter(
      (l) => l.dueDate >= todayStr && l.dueDate <= nextSevenDaysStr
    ).length;

    // ─── 6. FINANCIAL ANALYTICS ───
    const principalRecovered = allPayments
      .filter((p) => p.paymentType === "principal")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const remainingPrincipal = Math.max(totalLent - principalRecovered, 0);
    const totalExpectedCollection = totalOutstanding;
    const netProfit = totalInterestEarned + totalPenaltiesCollected;

    // Apply Filter values if range is defined
    let finalLent = totalLent;
    let finalCollected = totalCollected;
    let finalInterest = totalInterestEarned;

    if (filterStart && filterEnd) {
      finalLent = allLoans
        .filter((l) => l.dateGiven >= filterStart && l.dateGiven <= filterEnd)
        .reduce((sum, l) => sum + Number(l.principal), 0);
      finalCollected = allPayments
        .filter((p) => p.paymentDate >= filterStart && p.paymentDate <= filterEnd)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      finalInterest = allPayments
        .filter(
          (p) =>
            p.paymentDate >= filterStart &&
            p.paymentDate <= filterEnd &&
            p.paymentType === "interest"
        )
        .reduce((sum, p) => sum + Number(p.amount), 0);
    }

    // ─── 7. CHARTS DATA GENERATION ───
    // Get last 7 days daily counts
    const dailyLending: { date: string; amount: number }[] = [];
    const dailyCollections: { date: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().split("T")[0];
      const displayLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const lentAmt = allLoans
        .filter((l) => l.dateGiven === dStr)
        .reduce((sum, l) => sum + Number(l.principal), 0);
      const collAmt = allPayments
        .filter((p) => p.paymentDate === dStr)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      dailyLending.push({ date: displayLabel, amount: lentAmt });
      dailyCollections.push({ date: displayLabel, amount: collAmt });
    }

    // Monthly Trends for last 6 months
    const monthlyLendingVsCollections: { month: string; lent: number; collected: number }[] = [];
    const interestOverTime: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const mStartStr = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
      const mEndStr = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];

      const mLent = allLoans
        .filter((l) => l.dateGiven >= mStartStr && l.dateGiven <= mEndStr)
        .reduce((sum, l) => sum + Number(l.principal), 0);
      const mColl = allPayments
        .filter((p) => p.paymentDate >= mStartStr && p.paymentDate <= mEndStr)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const mInterest = allPayments
        .filter((p) => p.paymentDate >= mStartStr && p.paymentDate <= mEndStr && p.paymentType === "interest")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      monthlyLendingVsCollections.push({ month: mLabel, lent: mLent, collected: mColl });
      interestOverTime.push({ month: mLabel, amount: mInterest });
    }

    // Status distributions
    const statusCounts = allLoans.reduce((acc: Record<string, number>, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    const statusDistribution = [
      { status: "Active", count: statusCounts["active"] || 0, color: "#FFD700" },
      { status: "Overdue", count: statusCounts["overdue"] || 0, color: "#EF4444" },
      { status: "Extended", count: statusCounts["extended"] || 0, color: "#F59E0B" },
      { status: "Closed", count: statusCounts["closed"] || 0, color: "#10B981" },
      { status: "Submitted", count: statusCounts["submitted"] || 0, color: "#6366F1" },
    ];

    // ─── 8. PENALTY REPORT ANALYTICS ───
    const todaysPenaltyCollected = allPayments
      .filter((p) => p.paymentDate === todayStr && p.paymentType === "penalty")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const monthlyPenaltyCollected = allPayments
      .filter((p) => p.paymentDate >= thisMonthStartStr && p.paymentDate <= thisMonthEndStr && p.paymentType === "penalty")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    let outstandingPenalty = 0;
    const activePenaltyBorrowersSet = new Set<string>();

    for (const loan of nonClosedLoans) {
      const pInfo = calculateAccruedPenalty({
        principal: Number(loan.principal),
        dueDate: loan.dueDate,
        status: loan.status,
        penaltyType: (loan as any).penaltyType || "fixed",
        penaltyRate: Number((loan as any).penaltyRate || 50),
        manualPenaltyAmount: Number(loan.penaltyAmount || 0),
      });

      if (pInfo.totalPenalty > 0) {
        outstandingPenalty += pInfo.totalPenalty;
        activePenaltyBorrowersSet.add(loan.borrowerId);
      }
    }

    return {
      success: true,
      data: {
        summary: {
          totalLent: finalLent,
          totalCollected: finalCollected,
          totalOutstanding,
          totalInterestEarned: finalInterest,
          activeLoansCount: activeCount,
          closedLoansCount: closedLoans.length,
        },
        today: {
          lentToday,
          collectedToday,
          interestToday,
          borrowersToday,
          closedToday,
        },
        monthly: {
          lentThisMonth,
          collectedThisMonth,
          interestThisMonth,
          newLoansThisMonth,
          closedLoansThisMonth,
        },
        borrowers: {
          total: totalBorrowersCount,
          active: activeBorrowersCount,
          closed: closedBorrowersCount,
          overdue: overdueBorrowersCount,
        },
        loans: {
          active: activeCount + overdueCount,
          dueToday: dueTodayCount,
          overdue: overdueCount,
          closingSevenDays: closingSevenDaysCount,
        },
        analytics: {
          principalGiven: totalLent,
          principalRecovered,
          interestReceived: totalInterestEarned,
          remainingPrincipal,
          totalExpectedCollection,
          netProfit,
        },
        penalty: {
          todaysPenaltyCollected,
          monthlyPenaltyCollected,
          totalPenaltyCollected: totalPenaltiesCollected,
          outstandingPenalty: Math.round(outstandingPenalty * 100) / 100,
          borrowersWithActivePenalties: activePenaltyBorrowersSet.size,
          totalPenaltyIncome: totalPenaltiesCollected,
        },
        charts: {
          dailyLending,
          dailyCollections,
          monthlyLendingVsCollections,
          interestOverTime,
          statusDistribution,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to compile financial analytics" };
  }
}
