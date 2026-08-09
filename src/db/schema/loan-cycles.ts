import {
  pgTable, pgEnum, uuid, numeric, date, text, timestamp, index, integer
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";

export const cycleStatusEnum = pgEnum("cycle_status", [
  "active",
  "paid",
  "overdue_closed",
  "extended",
]);

export const loanCyclesTable = pgTable("loan_cycles", {
  cycleId: uuid("cycle_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loansTable.loanId, { onDelete: "cascade" }),

  cycleNumber: integer("cycle_number").notNull().default(1),

  startDate: date("start_date").notNull(),
  originalDueDate: date("original_due_date").notNull(),
  actualPaymentDate: date("actual_payment_date"),

  principalAmount: numeric("principal_amount", { precision: 12, scale: 2 }).notNull(),
  interestAmount: numeric("interest_amount", { precision: 12, scale: 2 }).notNull(),
  interestPaid: numeric("interest_paid", { precision: 12, scale: 2 }).default("0"),

  penaltyAmount: numeric("penalty_amount", { precision: 12, scale: 2 }).default("0"),
  penaltyPaid: numeric("penalty_paid", { precision: 12, scale: 2 }).default("0"),

  totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).default("0"),
  remainingPrincipal: numeric("remaining_principal", { precision: 12, scale: 2 }).notNull(),

  cycleStatus: cycleStatusEnum("cycle_status").notNull().default("active"),
  paymentType: text("payment_type"),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_loan_cycles_loan_id").on(table.loanId),
  index("idx_loan_cycles_status").on(table.cycleStatus),
]);

export type LoanCycle = typeof loanCyclesTable.$inferSelect;
export type InsertLoanCycle = typeof loanCyclesTable.$inferInsert;
