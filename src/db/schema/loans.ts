import {
  pgTable, pgEnum, uuid, numeric, date, timestamp, index, text
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

export const penaltyTypeEnum = pgEnum("penalty_type", [
  "fixed",
  "percentage",
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

  penaltyType: penaltyTypeEnum("penalty_type").notNull().default("fixed"),
  
  penaltyRate: numeric("penalty_rate", { precision: 8, scale: 2 }).notNull().default("50.00"),

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

export const penaltyLedgerTable = pgTable("penalty_ledger", {
  ledgerId: uuid("ledger_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loansTable.loanId, { onDelete: "cascade" }),

  calculationDate: date("calculation_date").notNull(),
  daysOverdue: numeric("days_overdue").notNull(),
  penaltyAdded: numeric("penalty_added", { precision: 12, scale: 2 }).notNull(),
  outstandingBefore: numeric("outstanding_before", { precision: 12, scale: 2 }).notNull(),
  outstandingAfter: numeric("outstanding_after", { precision: 12, scale: 2 }).notNull(),

  adminName: text("admin_name"),
  remarks: text("remarks"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_penalty_ledger_loan_id").on(table.loanId),
  index("idx_penalty_ledger_date").on(table.calculationDate),
]);

export type Loan = typeof loansTable.$inferSelect;
export type InsertLoan = typeof loansTable.$inferInsert;
export type LoanStatus = "active" | "overdue" | "extended" | "closed";
export type InterestType = "monthly" | "daily";
export type PenaltyType = "fixed" | "percentage";

export type PenaltyLedger = typeof penaltyLedgerTable.$inferSelect;
export type InsertPenaltyLedger = typeof penaltyLedgerTable.$inferInsert;
