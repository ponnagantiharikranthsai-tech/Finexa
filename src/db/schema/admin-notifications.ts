import {
  pgTable, uuid, text, timestamp, boolean, integer, numeric, index
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

  dedupKey: text("dedup_key").unique(), // e.g. "loanId_10d_dueDate" or "loanId_overdue_dueDate_3d"
  reminderType: text("reminder_type").notNull().default("10d"), // '10d', '3d', 'due_today', 'overdue'

  priority: text("priority").notNull().default("blue"), // 'blue', 'amber', 'red'
  title: text("title").notNull(),
  message: text("message").notNull(),

  // Rich Notification Payload Fields
  borrowerName: text("borrower_name"),
  borrowerMobile: text("borrower_mobile"),
  principalAmount: numeric("principal_amount", { precision: 12, scale: 2 }),
  outstandingAmount: numeric("outstanding_amount", { precision: 12, scale: 2 }),
  interestRate: numeric("interest_rate", { precision: 8, scale: 4 }),
  dueDate: text("due_date"),
  currentDate: text("current_date"),
  daysRemaining: integer("days_remaining"),
  overdueDays: integer("overdue_days"),
  penaltyAmount: numeric("penalty_amount", { precision: 12, scale: 2 }),
  currentTotalPayable: numeric("current_total_payable", { precision: 12, scale: 2 }),
  loanStatus: text("loan_status"),
  paymentStatus: text("payment_status"),

  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_admin_notifications_is_read").on(table.isRead, table.createdAt),
  index("idx_admin_notifications_loan_id").on(table.loanId),
  index("idx_admin_notifications_dedup_key").on(table.dedupKey),
]);

export const completedNotificationKeysTable = pgTable("completed_notification_keys", {
  dedupKey: text("dedup_key").primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type AdminNotification = typeof adminNotificationsTable.$inferSelect;
export type InsertAdminNotification = typeof adminNotificationsTable.$inferInsert;
export type CompletedNotificationKey = typeof completedNotificationKeysTable.$inferSelect;
