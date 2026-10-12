import { relations } from "drizzle-orm";
import { loansTable } from "./loans";
import { borrowersTable } from "./borrowers";
import { paymentsTable } from "./payments";
import { borrowerPortalTokens } from "./borrower-portal";

export const loansRelations = relations(loansTable, ({ one, many }) => ({
  borrower: one(borrowersTable, {
    fields: [loansTable.borrowerId],
    references: [borrowersTable.borrowerId],
  }),
  payments: many(paymentsTable),
  portalTokens: many(borrowerPortalTokens),
}));

export const borrowersRelations = relations(borrowersTable, ({ many }) => ({
  loans: many(loansTable),
}));

export const borrowerPortalTokensRelations = relations(borrowerPortalTokens, ({ one }) => ({
  loan: one(loansTable, {
    fields: [borrowerPortalTokens.loanId],
    references: [loansTable.loanId],
  }),
}));
