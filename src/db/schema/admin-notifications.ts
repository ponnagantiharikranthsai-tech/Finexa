import {
  pgTable, uuid, text, timestamp, boolean, index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";
import { paymentRemindersTable } from "./payment-reminders";

export const adminNotificationsTable = pgTable("admin_notifications", {
  notificationId: uuid("notification_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  reminderId: uuid("reminder_id")
    .references(() => paymentRemindersTable.reminderId, { onDelete: "set null" }),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loansTable.loanId, { onDelete: "cascade" }),

  priority: text("priority").notNull().default("blue"), // 'blue', 'amber', 'red'
  title: text("title").notNull(),
  message: text("message").notNull(),

  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_admin_notifications_is_read").on(table.isRead, table.createdAt),
  index("idx_admin_notifications_loan_id").on(table.loanId),
]);

export type AdminNotification = typeof adminNotificationsTable.$inferSelect;
export type InsertAdminNotification = typeof adminNotificationsTable.$inferInsert;
