import { DomainError } from "@/lib/errors";
import { differenceInCalendarMonths } from "date-fns";

export function calculatePeriods(dateGiven: Date | string, dueDate: Date | string, interestType?: string): number {
  const given = new Date(dateGiven);
  const due = new Date(dueDate);

  if (interestType === "weekly") {
    const totalDays = Math.ceil((due.getTime() - given.getTime()) / (1000 * 3600 * 24));
    return Math.max(1, Math.round(totalDays / 7));
  }
  if (interestType === "daily") {
    const totalDays = Math.ceil((due.getTime() - given.getTime()) / (1000 * 3600 * 24));
    return Math.max(1, totalDays);
  }

  return Math.max(1, differenceInCalendarMonths(due, given));
}

/**
 * Calculates monthly interest based on principal and rate per thousand per month.
 * BR-1: interest = (principal / 1000) * ratePerThousand
 */
export function calculateMonthlyInterest(principal: number, ratePerThousand: number): number {
  if (principal < 0 || ratePerThousand < 0) {
    throw new DomainError("Principal and interest rate must be positive values.");
  }
  if (principal === 0 || ratePerThousand === 0) {
    return 0;
  }
  return (principal / 1000) * ratePerThousand;
}

/**
 * Calculates weekly interest (rate per thousand per week).
 * interest = (principal / 1000) * ratePerThousand
 */
export function calculateWeeklyInterest(principal: number, ratePerThousand: number): number {
  return calculateMonthlyInterest(principal, ratePerThousand);
}

/**
 * Calculates daily interest (monthly interest divided by 30).
 */
export function calculateDailyInterest(principal: number, ratePerThousand: number): number {
  return calculateMonthlyInterest(principal, ratePerThousand) / 30;
}

/**
 * Calculates the outstanding balance.
 * outstanding = principal + interestCharged + penaltyCharged - totalPaymentsReceived
 */
export function calculateOutstandingBalance(
  principal: number,
  interestCharged: number,
  penaltyCharged: number,
  totalPayments: number
): number {
  const outstanding = principal + interestCharged + penaltyCharged - totalPayments;
  return Math.max(0, outstanding);
}
