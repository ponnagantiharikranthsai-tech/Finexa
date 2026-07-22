export type PenaltyParams = {
  principal: number;
  dueDate: string | Date;
  status: string;
  penaltyType?: "fixed" | "percentage" | null;
  penaltyRate?: number | string | null;
  manualPenaltyAmount?: number | string | null;
};

export type PenaltyResult = {
  daysOverdue: number;
  isPenaltyActive: boolean;
  dailyPenalty: number;
  autoPenaltyAccrued: number;
  totalPenalty: number;
  penaltyType: "fixed" | "percentage";
  penaltyRate: number;
};

/**
 * Calculates penalty automatically based on due date, days overdue, and rule (fixed or percentage).
 * - Fixed: e.g. ₹50 / day
 * - Percentage: e.g. 1% per day of principal
 * - Penalty is 0 if due date has not passed or loan is closed.
 */
export function calculateAccruedPenalty(params: PenaltyParams): PenaltyResult {
  const pType: "fixed" | "percentage" = params.penaltyType === "percentage" ? "percentage" : "fixed";
  const pRate = Number(params.penaltyRate ?? 50.00);
  const manualAmount = Number(params.manualPenaltyAmount || 0);

  if (params.status === "closed") {
    return {
      daysOverdue: 0,
      isPenaltyActive: manualAmount > 0,
      dailyPenalty: 0,
      autoPenaltyAccrued: 0,
      totalPenalty: manualAmount,
      penaltyType: pType,
      penaltyRate: pRate,
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
      autoPenaltyAccrued: 0,
      totalPenalty: manualAmount,
      penaltyType: pType,
      penaltyRate: pRate,
    };
  }

  let dailyPenalty = 0;
  if (pType === "percentage") {
    // e.g. 1% per day = (1 / 100) * principal
    dailyPenalty = (pRate / 100) * Number(params.principal);
  } else {
    // e.g. ₹50 per day
    dailyPenalty = pRate;
  }

  const autoPenaltyAccrued = Math.round(daysOverdue * dailyPenalty * 100) / 100;
  const totalPenalty = Math.round((manualAmount + autoPenaltyAccrued) * 100) / 100;

  return {
    daysOverdue,
    isPenaltyActive: totalPenalty > 0,
    dailyPenalty: Math.round(dailyPenalty * 100) / 100,
    autoPenaltyAccrued,
    totalPenalty,
    penaltyType: pType,
    penaltyRate: pRate,
  };
}
