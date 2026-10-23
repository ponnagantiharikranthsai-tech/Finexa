import { addMonths, addDays, endOfMonth, getDate, setDate } from "date-fns";

/**
 * Calculates due date for a loan term (BR-2).
 * For "weekly", adds 7 * multiplier days.
 * For "daily", adds 30 * multiplier days.
 * For "monthly", adds multiplier months handling month boundaries.
 */
export function calculateDueDate(
  dateGiven: Date,
  interestType: "monthly" | "daily" | "weekly" = "monthly",
  multiplier: number = 1
): Date {
  const count = Math.max(1, multiplier);
  if (interestType === "weekly") {
    return addDays(dateGiven, 7 * count);
  }
  if (interestType === "daily") {
    return addDays(dateGiven, 30 * count);
  }

  const targetMonth = addMonths(dateGiven, count);
  const givenDay = getDate(dateGiven);
  const endOfTargetMonth = endOfMonth(targetMonth);
  const maxDayInTargetMonth = getDate(endOfTargetMonth);

  if (givenDay > maxDayInTargetMonth) {
    return endOfTargetMonth;
  }
  return setDate(targetMonth, givenDay);
}

export function calculateCustomDueDate(dateGiven: Date, days: number): Date {
  return addDays(dateGiven, Math.max(1, days));
}
