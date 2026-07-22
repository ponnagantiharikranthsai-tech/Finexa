export type PenaltyParams = {
  principal: number;
  dueDate: string | Date;
  status: string;
  penaltyRate?: number | string | null;
  manualPenaltyAmount?: number | string | null;
};

export type PenaltyResult = {
  daysOverdue: number;
  isPenaltyActive: boolean;
  dailyPenalty: number;
  totalPenalty: number;
  penaltyRatePerThousand: number;
};

/**
 * Calculates penalty automatically based on principal, due date, overdue days, and penalty rate per ₹1,000/day.
 * Formula: Penalty = (Principal / 1000) * PenaltyRatePerThousand * OverdueDays
 * - Penalty is ₹0 if loan is Active, Due Today, Completed/Closed, or Overdue Days <= 0.
 */
export function calculateAccruedPenalty(params: PenaltyParams): PenaltyResult {
  const pRatePerThousand = Number(params.penaltyRate ?? 20.00);
  const manualAmount = Number(params.manualPenaltyAmount || 0);

  if (params.status === "closed") {
    return {
      daysOverdue: 0,
      isPenaltyActive: manualAmount > 0,
      dailyPenalty: 0,
      totalPenalty: manualAmount,
      penaltyRatePerThousand: pRatePerThousand,
    };
  }

  const todayStr = new Date().toISOString().split("T")[0]!;
  const today = new Date(todayStr);

  const dueStr = new Date(params.dueDate).toISOString().split("T")[0]!;
  const due = new Date(dueStr);

  const diffTime = today.getTime() - due.getTime();
  const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  if (daysOverdue <= 0) {
    return {
      daysOverdue: 0,
      isPenaltyActive: manualAmount > 0,
      dailyPenalty: 0,
      totalPenalty: manualAmount,
      penaltyRatePerThousand: pRatePerThousand,
    };
  }

  // Formula: Daily Penalty = (Principal / 1000) * Penalty Rate per ₹1,000 / day
  const dailyPenalty = (Number(params.principal) / 1000) * pRatePerThousand;
  const autoPenaltyAccrued = daysOverdue * dailyPenalty;
  const totalPenalty = Math.round((manualAmount + autoPenaltyAccrued) * 100) / 100;

  return {
    daysOverdue,
    isPenaltyActive: totalPenalty > 0,
    dailyPenalty: Math.round(dailyPenalty * 100) / 100,
    totalPenalty,
    penaltyRatePerThousand: pRatePerThousand,
  };
}
