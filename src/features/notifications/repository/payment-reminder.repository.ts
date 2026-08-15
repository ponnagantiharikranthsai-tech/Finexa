import { db } from "@/db/client";
import {
  paymentRemindersTable,
  adminNotificationsTable,
  completedNotificationKeysTable,
  pushSubscriptionsTable,
  pushedNotificationKeysTable,
  loansTable,
  borrowersTable,
} from "@/db/schema";
import { eq, and, lte, desc, sql, inArray } from "drizzle-orm";
import { format, subDays, addDays, parseISO, differenceInDays } from "date-fns";
import { sendWebPushToAllSubscriptions } from "../utils/web-push";

export type ReminderIntervalKey = "10d" | "3d" | "due_date" | "overdue";

export type ReminderScheduleOptions = {
  enabledIntervals: Record<ReminderIntervalKey, boolean>;
  scheduledTime?: string;
  soundEnabled?: boolean;
};

export const DEFAULT_REMINDER_OPTIONS: ReminderScheduleOptions = {
  enabledIntervals: {
    "10d": true,
    "3d": true,
    due_date: true,
    overdue: true,
  },
  scheduledTime: "10:00",
  soundEnabled: true,
};

// Safe date parser handling Date instances, YYYY-MM-DD strings, ISO strings, etc.
export function parseAnyDate(dateInput: any): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.substring(0, 10).split("-");
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Format ISO/YYYY-MM-DD date to "15 August 2026"
function formatDateVerbose(dateInput: any): string {
  if (!dateInput) return "";
  try {
    let year: number, month: number, day: number;
    if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput.trim())) {
      const parts = dateInput.trim().substring(0, 10).split("-");
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
    const realMonths = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${day} ${realMonths[month]} ${year}`;
  } catch (e) {
    return String(dateInput);
  }
}

let isTableInitialized = false;

export async function ensureReminderTablesExist() {
  if (isTableInitialized) return;
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS payment_reminders (
        reminder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id UUID NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
        interval_key TEXT NOT NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time TEXT NOT NULL DEFAULT '10:00',
        status TEXT NOT NULL DEFAULT 'pending',
        is_contacted BOOLEAN NOT NULL DEFAULT false,
        contacted_at TIMESTAMPTZ,
        notes TEXT,
        sound_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,

      `CREATE TABLE IF NOT EXISTS admin_notifications (
        notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reminder_id UUID REFERENCES payment_reminders(reminder_id) ON DELETE SET NULL,
        loan_id UUID NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
        dedup_key TEXT UNIQUE,
        reminder_type TEXT NOT NULL DEFAULT '10d',
        priority TEXT NOT NULL DEFAULT 'blue',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        borrower_name TEXT,
        borrower_mobile TEXT,
        principal_amount NUMERIC(12,2),
        outstanding_amount NUMERIC(12,2),
        interest_rate NUMERIC(8,4),
        due_date TEXT,
        current_date TEXT,
        days_remaining INTEGER,
        overdue_days INTEGER,
        penalty_amount NUMERIC(12,2),
        current_total_payable NUMERIC(12,2),
        loan_status TEXT,
        payment_status TEXT,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMPTZ,
        is_completed BOOLEAN NOT NULL DEFAULT false,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,

      `CREATE TABLE IF NOT EXISTS completed_notification_keys (
        dedup_key TEXT PRIMARY KEY,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,

      `CREATE TABLE IF NOT EXISTS push_subscriptions (
        subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,

      `CREATE TABLE IF NOT EXISTS pushed_notification_keys (
        dedup_key TEXT PRIMARY KEY,
        pushed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,

      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS dedup_key TEXT UNIQUE;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS reminder_type TEXT NOT NULL DEFAULT '10d';`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS borrower_name TEXT;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS borrower_mobile TEXT;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS principal_amount NUMERIC(12,2);`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(12,2);`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(8,4);`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS due_date TEXT;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS current_date TEXT;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS days_remaining INTEGER;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS overdue_days INTEGER;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(12,2);`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS current_total_payable NUMERIC(12,2);`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS loan_status TEXT;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS payment_status TEXT;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false;`,
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;`,

      `CREATE INDEX IF NOT EXISTS idx_payment_reminders_loan_status ON payment_reminders(loan_id, status);`,
      `CREATE INDEX IF NOT EXISTS idx_payment_reminders_scheduled_date ON payment_reminders(scheduled_date, status);`,
      `CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_admin_notifications_dedup_key ON admin_notifications(dedup_key);`
    ];

    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (e) {}
    }
    isTableInitialized = true;
  } catch (err: any) {
    console.error("Error initializing reminder tables:", err.message);
  }
}

export const paymentReminderRepository = {
  async createScheduleForLoan(
    loanId: string,
    dueDateStr: string,
    options: ReminderScheduleOptions = DEFAULT_REMINDER_OPTIONS
  ) {
    await ensureReminderTablesExist();

    await db
      .delete(paymentRemindersTable)
      .where(
        and(
          eq(paymentRemindersTable.loanId, loanId),
          eq(paymentRemindersTable.status, "pending")
        )
      );

    const baseDueDate = parseAnyDate(dueDateStr);
    if (!baseDueDate) return;

    // Strict 4 cycles: 10d, 3d, due_date, overdue
    const intervals: Array<{ key: ReminderIntervalKey; calcDate: Date }> = [
      { key: "10d", calcDate: subDays(baseDueDate, 10) },
      { key: "3d", calcDate: subDays(baseDueDate, 3) },
      { key: "due_date", calcDate: baseDueDate },
      { key: "overdue", calcDate: addDays(baseDueDate, 1) },
    ];

    const toInsert = intervals
      .filter((item) => options.enabledIntervals[item.key] !== false)
      .map((item) => ({
        loanId,
        intervalKey: item.key,
        scheduledDate: format(item.calcDate, "yyyy-MM-dd"),
        scheduledTime: options.scheduledTime || "10:00",
        status: "pending",
        soundEnabled: options.soundEnabled !== false,
      }));

    if (toInsert.length > 0) {
      await db.insert(paymentRemindersTable).values(toInsert);
    }
  },

  async savePushSubscription(endpoint: string, p256dh: string, auth: string, userId?: string) {
    await ensureReminderTablesExist();
    if (!endpoint || !p256dh || !auth) return;

    try {
      await db.insert(pushSubscriptionsTable).values({
        endpoint,
        p256dh,
        auth,
        userId: userId || null,
        createdAt: new Date(),
      }).onConflictDoNothing();
    } catch (e: any) {
      console.error("Error saving push subscription:", e.message);
    }
  },

  async removePushSubscription(endpoint: string) {
    await ensureReminderTablesExist();
    if (!endpoint) return;
    try {
      await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    } catch (e: any) {
      console.error("Error removing push subscription:", e.message);
    }
  },

  async recalculateScheduleForExtension(loanId: string, newDueDateStr: string) {
    await ensureReminderTablesExist();

    const newDueDate = parseAnyDate(newDueDateStr);
    if (!newDueDate) return;

    const pending = await db
      .select()
      .from(paymentRemindersTable)
      .where(
        and(
          eq(paymentRemindersTable.loanId, loanId),
          eq(paymentRemindersTable.status, "pending")
        )
      );

    for (const item of pending) {
      let newCalcDate = newDueDate;
      if (item.intervalKey === "10d") newCalcDate = subDays(newDueDate, 10);
      else if (item.intervalKey === "3d") newCalcDate = subDays(newDueDate, 3);
      else if (item.intervalKey === "due_date") newCalcDate = newDueDate;
      else if (item.intervalKey === "overdue") newCalcDate = addDays(newDueDate, 1);

      await db
        .update(paymentRemindersTable)
        .set({
          scheduledDate: format(newCalcDate, "yyyy-MM-dd"),
          updatedAt: new Date(),
        })
        .where(eq(paymentRemindersTable.reminderId, item.reminderId));
    }
  },

  async cancelRemindersForLoan(loanId: string) {
    await ensureReminderTablesExist();
    await db
      .update(paymentRemindersTable)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentRemindersTable.loanId, loanId),
          eq(paymentRemindersTable.status, "pending")
        )
      );
  },

  async syncAndProcessDueReminders() {
    await ensureReminderTablesExist();
  },

  async getAdminNotifications(overrideTodayStr?: string) {
    await ensureReminderTablesExist();

    // 1. Fetch completed notification dedup keys from database
    const completedRows = await db
      .select({ dedupKey: completedNotificationKeysTable.dedupKey })
      .from(completedNotificationKeysTable);
    const completedKeysSet = new Set(completedRows.map((r) => r.dedupKey));

    // 2. Fetch ALL active, overdue, extended, or submitted loans in the database
    const activeLoans = await db
      .select({
        loan: loansTable,
        borrowerName: borrowersTable.name,
        borrowerMobile: borrowersTable.mobile,
      })
      .from(loansTable)
      .innerJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .where(inArray(loansTable.status, ["submitted", "active", "overdue", "extended"]));

    if (activeLoans.length === 0) return [];

    // Compute actual outstanding balances for all active loans to filter out fully paid ones
    const loansOnly = activeLoans.map((item) => item.loan);
    const { loanRepository } = await import("@/features/loans/repository/loan.repository");
    const balancesMap = await loanRepository.getOutstandingBalancesForLoans(loansOnly);

    // Local Midnight Date (Date-only comparison)
    const todayStr = overrideTodayStr || format(new Date(), "yyyy-MM-dd");
    const [tY, tM, tD] = todayStr.split("-").map(Number);
    const today = new Date(tY, tM - 1, tD);

    const dynamicNotifications: any[] = [];

    for (const item of activeLoans) {
      const { loan, borrowerName, borrowerMobile } = item;

      // Exclude CLOSED loans
      if (loan.status === "closed") continue;

      // Exclude FULLY PAID loans (outstanding <= 0)
      const outstanding = balancesMap.get(loan.loanId) ?? Number(loan.principal || 0);
      if (outstanding <= 0) continue;

      const dueObj = parseAnyDate(loan.dueDate);
      if (!dueObj) continue;

      const dueNormalized = new Date(dueObj.getFullYear(), dueObj.getMonth(), dueObj.getDate());
      const dueDateStr = format(dueNormalized, "yyyy-MM-dd");
      const verboseDueDate = formatDateVerbose(dueNormalized);

      // EXACT Calendar-Date Difference (ignoring hours/minutes/seconds)
      const diffDays = Math.round((dueNormalized.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const principalNum = Number(loan.principal || 0);
      const rateNum = Number(loan.interestRate || 0);
      const monthlyInt = Math.round((principalNum * rateNum) / 1000);
      const penaltyNum = Number(loan.penaltyAmount || 0);
      const totalPayable = Math.max(outstanding, principalNum + monthlyInt + penaltyNum);
      const payableFormatted = totalPayable.toLocaleString("en-IN");

      let categoryRank = 99; // 1: OVERDUE, 2: DUE TODAY, 3: 3 DAYS LEFT, 4: 10 DAYS LEFT
      let title = "";
      let message = "";
      let pushTitle = "";
      let pushBody = "";
      let priority = "blue";
      let reminderType = "";
      let trigger = false;
      let overdueDays = 0;
      let dedupKey = "";

      // STRICT NOTIFICATION CYCLES: 10D, 3D, DUE TODAY, OVERDUE
      if (diffDays < 0) {
        // OVERDUE: Appears every day until loan is paid in full!
        trigger = true;
        categoryRank = 1;
        overdueDays = Math.abs(diffDays);
        reminderType = "overdue";
        priority = "red";
        title = "Payment Overdue";
        message = `${borrowerName}'s payment is overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}.`;
        pushTitle = "FINEXA — Payment Overdue";
        pushBody = `${borrowerName}'s payment is overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}. Current payable amount: ₹${payableFormatted}.`;
        dedupKey = `notif_${loan.loanId}_overdue_${dueDateStr}_${todayStr}`;
      } else if (diffDays === 0) {
        // DUE TODAY
        trigger = true;
        categoryRank = 2;
        reminderType = "due_today";
        priority = "red";
        title = "Payment Due Today";
        message = `${borrowerName}'s loan payment is due today.`;
        pushTitle = "FINEXA — Payment Due Today";
        pushBody = `${borrowerName}'s payment of ₹${payableFormatted} is due today.`;
        dedupKey = `notif_${loan.loanId}_due_today_${dueDateStr}`;
      } else if (diffDays === 3) {
        // 3 DAYS BEFORE DUE DATE
        trigger = true;
        categoryRank = 3;
        reminderType = "3d";
        priority = "amber";
        title = "Payment Due in 3 Days";
        message = `${borrowerName} has a loan payment due on ${dueDateStr}. 3 days remaining.`;
        pushTitle = "FINEXA — Payment Reminder";
        pushBody = `${borrowerName}'s loan payment of ₹${payableFormatted} is due on ${verboseDueDate}. 3 days remaining.`;
        dedupKey = `notif_${loan.loanId}_3d_${dueDateStr}`;
      } else if (diffDays === 10) {
        // 10 DAYS BEFORE DUE DATE
        trigger = true;
        categoryRank = 4;
        reminderType = "10d";
        priority = "blue";
        title = "Payment Due in 10 Days";
        message = `${borrowerName} has a loan payment due on ${dueDateStr}. 10 days remaining.`;
        pushTitle = "FINEXA — Payment Reminder";
        pushBody = `${borrowerName}'s loan payment of ₹${payableFormatted} is due on ${verboseDueDate}. 10 days remaining.`;
        dedupKey = `notif_${loan.loanId}_10d_${dueDateStr}`;
      }

      // Check if this specific reminder instance has been marked as COMPLETED by admin
      if (trigger && dedupKey && !completedKeysSet.has(dedupKey)) {
        dynamicNotifications.push({
          notificationId: dedupKey,
          loanId: loan.loanId,
          dedupKey,
          borrowerName,
          borrowerMobile,
          reminderType,
          priority,
          title,
          message,
          isRead: false,
          isCompleted: false,
          createdAt: new Date().toISOString(),
          dueDate: dueDateStr,
          currentDate: todayStr,
          principal: principalNum,
          interestRate: rateNum,
          outstandingBalance: totalPayable,
          daysRemaining: diffDays >= 0 ? diffDays : 0,
          overdueDays,
          penaltyAmount: penaltyNum,
          currentTotalPayable: totalPayable,
          loanStatus: loan.status.toUpperCase(),
          paymentStatus: "UNPAID",
          categoryRank,
        });

        // Trigger Web Push notification asynchronously if new cycle
        sendWebPushToAllSubscriptions(dedupKey, {
          title: pushTitle,
          body: pushBody,
          icon: "/logo-icon.png",
          badge: "/logo-icon.png",
          url: `/loans/${loan.loanId}`,
          loanId: loan.loanId,
          tag: dedupKey,
        }).catch((err) => console.error("Web Push trigger error:", err));
      }
    }

    // Sort Notifications by Urgency Rank (1: OVERDUE, 2: DUE TODAY, 3: 3 DAYS, 4: 10 DAYS), then nearest due date
    dynamicNotifications.sort((a, b) => {
      if (a.categoryRank !== b.categoryRank) {
        return a.categoryRank - b.categoryRank;
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return dynamicNotifications;
  },

  async markNotificationCompleted(dedupKey: string) {
    await ensureReminderTablesExist();
    if (!dedupKey) return;

    try {
      await db.insert(completedNotificationKeysTable).values({
        dedupKey,
        completedAt: new Date(),
      }).onConflictDoNothing();

      await db.update(adminNotificationsTable).set({
        isCompleted: true,
        completedAt: new Date(),
      }).where(eq(adminNotificationsTable.dedupKey, dedupKey));
    } catch (err: any) {
      console.error("Error marking notification completed:", err.message);
    }
  },

  async markNotificationRead(notificationId: string) {
    await ensureReminderTablesExist();
  },

  async markAllNotificationsRead() {
    await ensureReminderTablesExist();
  },

  async markReminderContacted(reminderId: string, notes?: string) {
    await ensureReminderTablesExist();
  },

  async addReminderNote(reminderId: string, notes: string) {
    await ensureReminderTablesExist();
  },

  async getReminderHistoryByLoanId(loanId: string) {
    await ensureReminderTablesExist();
    const rows = await db
      .select()
      .from(paymentRemindersTable)
      .where(eq(paymentRemindersTable.loanId, loanId))
      .orderBy(paymentRemindersTable.scheduledDate);

    return rows;
  },
};
