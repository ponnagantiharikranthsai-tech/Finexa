import { addMonths, addDays, endOfMonth, getDate, setDate } from "date-fns";

/**
 * Calculates due date for a loan term (BR-2).
 * For "weekly", adds 7 days.
 * For "monthly", adds 1 month handling month boundaries.
 */
export function calculateDueDate(dateGiven: Date, interestType: "monthly" | "daily" | "weekly" = "monthly"): Date {
  if (interestType === "weekly") {
    return addDays(dateGiven, 7);
  }
  if (interestType === "daily") {
    return addDays(dateGiven, 30);
  }

  const targetMonth = addMonths(dateGiven, 1);
  const givenDay = getDate(dateGiven);
  const endOfTargetMonth = endOfMonth(targetMonth);
  const maxDayInTargetMonth = getDate(endOfTargetMonth);

  if (givenDay > maxDayInTargetMonth) {
    return endOfTargetMonth;
  }
  return setDate(targetMonth, givenDay);
}
