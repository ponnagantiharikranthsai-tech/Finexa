import { pgTable, uuid, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";

export const borrowerPortalTokens = pgTable("borrower_portal_tokens", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loansTable.loanId, { onDelete: "cascade" }),

  token: text("token").notNull().unique(),

  isActive: boolean("is_active").default(true).notNull(),

  viewsCount: integer("views_count").default(0).notNull(),

  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),

  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [
  index("idx_bpt_loan_id").on(table.loanId),
  index("idx_bpt_token").on(table.token),
]);

export const borrowerPortalTokensTable = borrowerPortalTokens;

export type BorrowerPortalToken = typeof borrowerPortalTokens.$inferSelect;
export type InsertBorrowerPortalToken = typeof borrowerPortalTokens.$inferInsert;
