import { pgTable, uuid, text, numeric, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const digitalEnvelopesTable = pgTable("digital_envelopes", {
  envelopeId: uuid("envelope_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"), // 'EMI', 'Savings', 'Investment', 'Friend / Third Party', etc.
  type: text("type").notNull().default("personal"), // 'personal' | 'third_party'
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }),
  color: text("color").default("gold"),
  icon: text("icon").default("wallet"),
  notes: text("notes"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_digital_envelopes_type").on(table.type),
  index("idx_digital_envelopes_category").on(table.category),
  index("idx_digital_envelopes_archived").on(table.isArchived),
]);

export const digitalEnvelopeTransactionsTable = pgTable("digital_envelope_transactions", {
  transactionId: uuid("transaction_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  envelopeId: uuid("envelope_id")
    .notNull()
    .references(() => digitalEnvelopesTable.envelopeId, { onDelete: "cascade" }),
  transactionType: text("transaction_type").notNull(), // 'deposit' | 'withdrawal' | 'pay_bill' | 'initial_deposit'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 12, scale: 2 }).notNull().default("0.00"),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull().default("0.00"),
  category: text("category"),
  description: text("description"),
  referenceParty: text("reference_party"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_det_envelope_id").on(table.envelopeId),
  index("idx_det_created_at").on(table.createdAt),
  index("idx_det_type").on(table.transactionType),
]);

export const digitalEnvelopeSettingsTable = pgTable("digital_envelope_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type DigitalEnvelope = typeof digitalEnvelopesTable.$inferSelect;
export type InsertDigitalEnvelope = typeof digitalEnvelopesTable.$inferInsert;
export type DigitalEnvelopeTransaction = typeof digitalEnvelopeTransactionsTable.$inferSelect;
export type InsertDigitalEnvelopeTransaction = typeof digitalEnvelopeTransactionsTable.$inferInsert;
export type DigitalEnvelopeSetting = typeof digitalEnvelopeSettingsTable.$inferSelect;

