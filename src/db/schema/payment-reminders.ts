import {
  pgTable, uuid, text, timestamp, boolean, date, index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";

export const paymentRemindersTable = pgTable("payment_reminders", {
  reminderId: uuid("reminder_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loansTable.loanId, { onDelete: "cascade" }),

  intervalKey: text("interval_key").notNull(), // '10d', '7d', '3d', '1d', 'due_date', 'overdue'
  scheduledDate: date("scheduled_date").notNull(), // YYYY-MM-DD
  scheduledTime: text("scheduled_time").notNull().default("10:00"),

  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'contacted', 'cancelled', 'dismissed'
  isContacted: boolean("is_contacted").notNull().default(false),
  contactedAt: timestamp("contacted_at", { withTimezone: true }),
  notes: text("notes"),

  soundEnabled: boolean("sound_enabled").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_payment_reminders_loan_status").on(table.loanId, table.status),
  index("idx_payment_reminders_scheduled_date").on(table.scheduledDate, table.status),
]);

export type PaymentReminder = typeof paymentRemindersTable.$inferSelect;
export type InsertPaymentReminder = typeof paymentRemindersTable.$inferInsert;
