import {
  pgTable, pgEnum, uuid, numeric, date, timestamp, index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { borrowersTable } from "./borrowers";

export const loanStatusEnum = pgEnum("loan_status", [
  "submitted",
  "active",
  "overdue",
  "extended",
  "closed",
]);

export const interestTypeEnum = pgEnum("interest_type", [
  "monthly",
  "daily",
]);

export const loansTable = pgTable("loans", {
  loanId: uuid("loan_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  borrowerId: uuid("borrower_id")
    .notNull()
    .references(() => borrowersTable.borrowerId),

  principal: numeric("principal", { precision: 12, scale: 2 }).notNull(),

  interestType: interestTypeEnum("interest_type").notNull(),

  interestRate: numeric("interest_rate", { precision: 8, scale: 4 }).notNull(),

  dateGiven: date("date_given").notNull(),
  dueDate: date("due_date").notNull(),

  status: loanStatusEnum("status").notNull().default("active"),

  penaltyAmount: numeric("penalty_amount", { precision: 12, scale: 2 })
    .default("0"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_loans_status").on(table.status),
  index("idx_loans_due_date").on(table.dueDate),
  index("idx_loans_borrower_id").on(table.borrowerId),
  index("idx_loans_status_due_date").on(table.status, table.dueDate),
  index("idx_loans_active_due_date").on(table.dueDate).where(sql`status = 'active'::loan_status OR status = 'overdue'::loan_status OR status = 'extended'::loan_status`),
]);

export type Loan = typeof loansTable.$inferSelect;
export type InsertLoan = typeof loansTable.$inferInsert;
export type LoanStatus = "active" | "overdue" | "extended" | "closed";
export type InterestType = "monthly" | "daily";
