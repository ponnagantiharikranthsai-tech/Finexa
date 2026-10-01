import { pgTable, uuid, text, numeric, date, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";
import { paymentsTable } from "./payments";

export const funderStatusEnum = pgEnum("funder_status", [
  "active",
  "returned",
]);

export const fundersTable = pgTable("funders", {
  funderId: uuid("funder_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  address: text("address").notNull(),
  capitalAmount: numeric("capital_amount", { precision: 12, scale: 2 }).notNull(),
  investmentDate: date("investment_date").notNull(),
  returnDueDate: date("return_due_date").notNull(),
  status: funderStatusEnum("status").notNull().default("active"),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_funders_status").on(table.status),
  index("idx_funders_mobile").on(table.mobile),
]);

export const capitalReturnsTable = pgTable("capital_returns", {
  returnId: uuid("return_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  funderId: uuid("funder_id")
    .notNull()
    .references(() => fundersTable.funderId, { onDelete: "cascade" }),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  returnDate: date("return_date").notNull(),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_capital_returns_funder_id").on(table.funderId),
]);

export const allocationStatusEnum = pgEnum("allocation_status", [
  "active",
  "returned",
  "released",
  "cancelled",
]);

export const capitalAllocationsTable = pgTable("capital_allocations", {
  allocationId: uuid("allocation_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  funderId: uuid("funder_id")
    .notNull()
    .references(() => fundersTable.funderId, { onDelete: "cascade" }),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loansTable.loanId, { onDelete: "cascade" }),

  paymentId: uuid("payment_id")
    .references(() => paymentsTable.paymentId, { onDelete: "set null" }),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  allocationDate: date("allocation_date").notNull().default(sql`CURRENT_DATE`),
  status: allocationStatusEnum("status").notNull().default("active"),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_capital_allocations_funder_id").on(table.funderId),
  index("idx_capital_allocations_loan_id").on(table.loanId),
  index("idx_capital_allocations_status").on(table.status),
  index("idx_capital_allocations_date").on(table.allocationDate),
]);

export type Funder = typeof fundersTable.$inferSelect;
export type InsertFunder = typeof fundersTable.$inferInsert;
export type CapitalReturn = typeof capitalReturnsTable.$inferSelect;
export type InsertCapitalReturn = typeof capitalReturnsTable.$inferInsert;
export type CapitalAllocation = typeof capitalAllocationsTable.$inferSelect;
export type InsertCapitalAllocation = typeof capitalAllocationsTable.$inferInsert;
export type AllocationStatus = "active" | "returned" | "released" | "cancelled";
