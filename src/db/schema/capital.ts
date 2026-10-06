import { pgTable, uuid, text, numeric, date, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";
import { paymentsTable } from "./payments";

export const funderStatusEnum = pgEnum("funder_status", [
  "active",
  "returned",
  "inactive",
]);

export const fundersTable = pgTable("funders", {
  funderId: uuid("funder_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
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

export const capitalFundingTransactionsTable = pgTable("capital_funding_transactions", {
  transactionId: uuid("transaction_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  transactionCode: text("transaction_code").notNull().unique(), // e.g. CF-001
  funderId: uuid("funder_id")
    .notNull()
    .references(() => fundersTable.funderId, { onDelete: "cascade" }),

  loanId: uuid("loan_id")
    .references(() => loansTable.loanId, { onDelete: "set null" }),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  fundingDate: date("funding_date").notNull().default(sql`CURRENT_DATE`),
  status: text("status").notNull().default("allocated"), // 'pending' | 'received' | 'allocated' | 'released'
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_cft_funder_id").on(table.funderId),
  index("idx_cft_loan_id").on(table.loanId),
  index("idx_cft_funding_date").on(table.fundingDate),
  index("idx_cft_status").on(table.status),
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

  fundingTransactionId: uuid("funding_transaction_id")
    .references(() => capitalFundingTransactionsTable.transactionId, { onDelete: "set null" }),

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

export type Funder = typeof fundersTable.$inferSelect & {
  fundingModel?: string;
  capitalAmount?: string;
  investmentDate?: string;
  returnDueDate?: string | null;
  address?: string | null;
  totalProvided?: number;
  currentlyAllocated?: number;
  unallocatedReceived?: number;
  totalCapital?: number;
  availableCapital?: number;
};
export type InsertFunder = typeof fundersTable.$inferInsert;
export type CapitalFundingTransaction = typeof capitalFundingTransactionsTable.$inferSelect;
export type InsertCapitalFundingTransaction = typeof capitalFundingTransactionsTable.$inferInsert;
export type CapitalReturn = typeof capitalReturnsTable.$inferSelect;
export type InsertCapitalReturn = typeof capitalReturnsTable.$inferInsert;
export type CapitalAllocation = typeof capitalAllocationsTable.$inferSelect;
export type InsertCapitalAllocation = typeof capitalAllocationsTable.$inferInsert;
export type AllocationStatus = "active" | "returned" | "released" | "cancelled";
