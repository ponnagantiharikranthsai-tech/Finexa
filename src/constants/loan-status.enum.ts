export const LoanStatus = {
  ACTIVE: "active",
  OVERDUE: "overdue",
  EXTENDED: "extended",
  CLOSED: "closed",
} as const;

export type LoanStatus = typeof LoanStatus[keyof typeof LoanStatus];
