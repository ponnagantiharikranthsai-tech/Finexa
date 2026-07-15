import {
  pgTable, pgEnum, uuid, numeric, date, text, timestamp, index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";

export const paymentTypeEnum = pgEnum("payment_type", [
  "interest",
  "principal",
  "penalty",
]);

export const paymentsTable = pgTable("payments", {
  paymentId: uuid("payment_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loansTable.loanId),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),

  paymentType: paymentTypeEnum("payment_type").notNull(),

  paymentDate: date("payment_date").notNull(),

  notes: text("notes"),

  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_payments_loan_id").on(table.loanId),
  index("idx_payments_payment_date").on(table.paymentDate),
]);

export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = typeof paymentsTable.$inferInsert;
export type PaymentType = "interest" | "principal" | "penalty";
