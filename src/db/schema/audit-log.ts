import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";

export const auditLogTable = pgTable("audit_log", {
  auditId: uuid("audit_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  loanId: uuid("loan_id")
    .references(() => loansTable.loanId),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_audit_log_timestamp").on(table.timestamp),
  index("idx_audit_log_entity_id").on(table.entityId),
  index("idx_audit_log_loan_id").on(table.loanId),
]);

export type AuditLog = typeof auditLogTable.$inferSelect;
export type InsertAuditLog = typeof auditLogTable.$inferInsert;
