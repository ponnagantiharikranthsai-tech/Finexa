import { addMonths, endOfMonth, getDate, setDate } from "date-fns";

/**
 * Calculates due date for a loan term (BR-2).
 * The due date is exactly one month after the date given.
 * Handles month boundaries, e.g. Jan 31 + 1 month = Feb 28 (or Feb 29 on leap years).
 */
export function calculateDueDate(dateGiven: Date): Date {
  const targetMonth = addMonths(dateGiven, 1);
  const givenDay = getDate(dateGiven);
  const endOfTargetMonth = endOfMonth(targetMonth);
  const maxDayInTargetMonth = getDate(endOfTargetMonth);

  if (givenDay > maxDayInTargetMonth) {
    return endOfTargetMonth;
  }
  return setDate(targetMonth, givenDay);
}
