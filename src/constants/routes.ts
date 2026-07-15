export const Routes = {
  LOGIN: "/login",
  DASHBOARD: "/",
  LOANS: "/loans",
  NEW_LOAN: "/loans/new",
  LOAN_DETAIL: (id: string) => `/loans/${id}`,
  BORROWERS: "/borrowers",
  BORROWER_DETAIL: (id: string) => `/borrowers/${id}`,
  REPORTS: "/reports",
} as const;
