import {
  pgTable, pgEnum, uuid, text, timestamp, index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loansTable } from "./loans";

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "whatsapp",
  "sms",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "creation",
  "reminder",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "sent",
  "failed",
]);

export const notificationsLogTable = pgTable("notifications_log", {
  notificationId: uuid("notification_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  loanId: uuid("loan_id")
    .notNull()
    .references(() => loansTable.loanId),

  channel: notificationChannelEnum("channel").notNull(),
  type: notificationTypeEnum("type").notNull(),
  status: notificationStatusEnum("status").notNull(),

  errorMessage: text("error_message"),

  sentAt: timestamp("sent_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_notifications_loan_id_type").on(table.loanId, table.type),
  index("idx_notifications_sent_at").on(table.sentAt),
]);

export type NotificationLog = typeof notificationsLogTable.$inferSelect;
export type InsertNotificationLog = typeof notificationsLogTable.$inferInsert;
