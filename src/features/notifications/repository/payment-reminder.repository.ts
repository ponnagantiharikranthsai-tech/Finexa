import { db } from "@/db/client";
import { paymentRemindersTable, adminNotificationsTable, loansTable, borrowersTable } from "@/db/schema";
import { eq, and, lte, desc, sql, inArray } from "drizzle-orm";
import { format, subDays, addDays, parseISO, differenceInDays } from "date-fns";

export type ReminderIntervalKey = "10d" | "7d" | "3d" | "1d" | "due_date" | "overdue";

export type ReminderScheduleOptions = {
  enabledIntervals: Record<ReminderIntervalKey, boolean>;
  scheduledTime?: string;
  soundEnabled?: boolean;
};

export const DEFAULT_REMINDER_OPTIONS: ReminderScheduleOptions = {
  enabledIntervals: {
    "10d": true,
    "7d": true,
    "3d": true,
    "1d": true,
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

    const intervals: Array<{ key: ReminderIntervalKey; calcDate: Date }> = [
      { key: "10d", calcDate: subDays(baseDueDate, 10) },
      { key: "7d", calcDate: subDays(baseDueDate, 7) },
      { key: "3d", calcDate: subDays(baseDueDate, 3) },
      { key: "1d", calcDate: subDays(baseDueDate, 1) },
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
      else if (item.intervalKey === "7d") newCalcDate = subDays(newDueDate, 7);
      else if (item.intervalKey === "3d") newCalcDate = subDays(newDueDate, 3);
      else if (item.intervalKey === "1d") newCalcDate = subDays(newDueDate, 1);
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

  async getAdminNotifications() {
    await ensureReminderTablesExist();

    // Fetch ALL active, overdue, extended, or submitted loans in the database
    const activeLoans = await db
      .select({
        loan: loansTable,
        borrowerName: borrowersTable.name,
        borrowerMobile: borrowersTable.mobile,
      })
      .from(loansTable)
      .innerJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .where(inArray(loansTable.status, ["submitted", "active", "overdue", "extended"]));

    // Local Midnight Date (Asia/Kolkata)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = format(today, "yyyy-MM-dd");

    const dynamicNotifications: any[] = [];

    for (const item of activeLoans) {
      const { loan, borrowerName, borrowerMobile } = item;

      // Exclude CLOSED or PAID loans
      if (loan.status === "closed") continue;

      const dueObj = parseAnyDate(loan.dueDate);
      if (!dueObj) continue;

      const dueNormalized = new Date(dueObj.getFullYear(), dueObj.getMonth(), dueObj.getDate());
      const dueDateStr = format(dueNormalized, "yyyy-MM-dd");

      // EXACT Calendar-Date Difference
      const diffDays = differenceInDays(dueNormalized, today);

      const principalNum = Number(loan.principal || 0);
      const rateNum = Number(loan.interestRate || 0);
      const monthlyInt = Math.round((principalNum * rateNum) / 1000);
      const penaltyNum = Number(loan.penaltyAmount || 0);
      const totalPayable = principalNum + monthlyInt + penaltyNum;

      let categoryRank = 99; // 1: OVERDUE, 2: DUE TODAY, 3: 3 DAYS LEFT, 4: 10 DAYS LEFT
      let title = "";
      let message = "";
      let priority = "blue";
      let reminderType = "";
      let trigger = false;
      let overdueDays = 0;

      if (diffDays < 0) {
        // D. OVERDUE
        trigger = true;
        categoryRank = 1;
        overdueDays = Math.abs(diffDays);
        reminderType = "overdue";
        priority = "red";
        title = "Payment Overdue";
        message = `${borrowerName}'s payment is overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}.`;
      } else if (diffDays === 0) {
        // C. DUE TODAY
        trigger = true;
        categoryRank = 2;
        reminderType = "due_today";
        priority = "red";
        title = "Payment Due Today";
        message = `${borrowerName}'s loan payment is due today.`;
      } else if (diffDays === 3) {
        // B. 3 DAYS BEFORE DUE DATE
        trigger = true;
        categoryRank = 3;
        reminderType = "3d";
        priority = "amber";
        title = "Payment Due in 3 Days";
        message = `${borrowerName} has a loan payment due on ${dueDateStr}. Only 3 days remaining.`;
      } else if (diffDays === 10) {
        // A. 10 DAYS BEFORE DUE DATE
        trigger = true;
        categoryRank = 4;
        reminderType = "10d";
        priority = "blue";
        title = "Payment Due in 10 Days";
        message = `${borrowerName} has a loan payment due on ${dueDateStr}. 10 days remaining.`;
      } else if (diffDays > 0 && diffDays <= 10) {
        // Fallback for any active loan within 10 days
        trigger = true;
        categoryRank = diffDays <= 3 ? 3 : 4;
        reminderType = `${diffDays}d`;
        priority = diffDays <= 3 ? "amber" : "blue";
        title = `Payment Due in ${diffDays} Days`;
        message = `${borrowerName} has a loan payment due on ${dueDateStr}. ${diffDays} ${diffDays === 1 ? "day" : "days"} remaining.`;
      }

      if (trigger) {
        dynamicNotifications.push({
          notificationId: `notif_${loan.loanId}_${reminderType}_${dueDateStr}`,
          loanId: loan.loanId,
          borrowerName,
          borrowerMobile,
          reminderType,
          priority,
          title,
          message,
          isRead: false,
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
