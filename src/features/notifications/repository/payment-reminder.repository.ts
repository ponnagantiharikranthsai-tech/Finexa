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

let isTableInitialized = false;

export async function ensureReminderTablesExist() {
  if (isTableInitialized) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payment_reminders (
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
      );

      CREATE TABLE IF NOT EXISTS admin_notifications (
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
      );

      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS dedup_key TEXT UNIQUE;
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS reminder_type TEXT NOT NULL DEFAULT '10d';
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS borrower_name TEXT;
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS borrower_mobile TEXT;
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS principal_amount NUMERIC(12,2);
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(12,2);
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(8,4);
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS due_date TEXT;
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS current_date TEXT;
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS days_remaining INTEGER;
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS overdue_days INTEGER;
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(12,2);
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS current_total_payable NUMERIC(12,2);
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS loan_status TEXT;
      ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS payment_status TEXT;

      CREATE INDEX IF NOT EXISTS idx_payment_reminders_loan_status ON payment_reminders(loan_id, status);
      CREATE INDEX IF NOT EXISTS idx_payment_reminders_scheduled_date ON payment_reminders(scheduled_date, status);
      CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read, created_at);
      CREATE INDEX IF NOT EXISTS idx_admin_notifications_dedup_key ON admin_notifications(dedup_key);
    `);
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

    const baseDueDate = parseISO(dueDateStr);
    if (isNaN(baseDueDate.getTime())) return;

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

    const newDueDate = parseISO(newDueDateStr);
    if (isNaN(newDueDate.getTime())) return;

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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = format(today, "yyyy-MM-dd");

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

    for (const item of activeLoans) {
      const { loan, borrowerName, borrowerMobile } = item;

      if (!loan.dueDate) continue;
      const dueParsed = parseISO(loan.dueDate);
      if (isNaN(dueParsed.getTime())) continue;

      const dueNormalized = new Date(dueParsed.getFullYear(), dueParsed.getMonth(), dueParsed.getDate());
      const dueDateStr = format(dueNormalized, "yyyy-MM-dd");

      // EXACT Calendar Date Difference using date-fns differenceInDays
      const diffDays = differenceInDays(dueNormalized, today);

      const principalNum = Number(loan.principal || 0);
      const rateNum = Number(loan.interestRate || 0);
      const monthlyInt = Math.round((principalNum * rateNum) / 1000);
      const penaltyNum = Number(loan.penaltyAmount || 0);
      const totalPayable = principalNum + monthlyInt + penaltyNum;
      const paymentStatus = loan.status === "closed" ? "PAID" : "UNPAID";

      let triggerReminder = false;
      let reminderType = "";
      let priority = "blue";
      let title = "";
      let message = "";
      let dedupKey = "";
      let overdueDays = 0;

      if (diffDays === 10) {
        // 1. 10 DAYS BEFORE DUE DATE
        triggerReminder = true;
        reminderType = "10d";
        priority = "blue";
        title = "10 DAYS LEFT";
        message = `Payment reminder: ${borrowerName} has 10 days remaining until the loan due date.`;
        dedupKey = `${loan.loanId}_10d_${dueDateStr}`;
      } else if (diffDays === 3) {
        // 2. 3 DAYS BEFORE DUE DATE
        triggerReminder = true;
        reminderType = "3d";
        priority = "amber";
        title = "3 DAYS LEFT";
        message = `Payment reminder: ${borrowerName} has only 3 days remaining until the loan due date.`;
        dedupKey = `${loan.loanId}_3d_${dueDateStr}`;
      } else if (diffDays === 0) {
        // 3. DUE TODAY
        triggerReminder = true;
        reminderType = "due_today";
        priority = "red";
        title = "DUE TODAY";
        message = `Payment due today: ${borrowerName}’s loan is due today.`;
        dedupKey = `${loan.loanId}_due_today_${dueDateStr}`;
      } else if (diffDays < 0) {
        // 4. OVERDUE
        triggerReminder = true;
        overdueDays = Math.abs(diffDays);
        reminderType = "overdue";
        priority = "red";
        title = `${overdueDays} DAYS OVERDUE`;
        message = `Payment overdue: ${borrowerName}’s loan is ${overdueDays} days overdue.`;
        dedupKey = `${loan.loanId}_overdue_${dueDateStr}_${overdueDays}d`;
      }

      if (triggerReminder && dedupKey) {
        try {
          await db.insert(adminNotificationsTable).values({
            loanId: loan.loanId,
            dedupKey,
            reminderType,
            priority,
            title,
            message,
            borrowerName,
            borrowerMobile,
            principalAmount: principalNum.toString(),
            outstandingAmount: totalPayable.toString(),
            interestRate: rateNum.toString(),
            dueDate: dueDateStr,
            currentDate: todayStr,
            daysRemaining: diffDays >= 0 ? diffDays : 0,
            overdueDays,
            penaltyAmount: penaltyNum.toString(),
            currentTotalPayable: totalPayable.toString(),
            loanStatus: loan.status.toUpperCase(),
            paymentStatus,
            isRead: false,
          }).onConflictDoNothing();
        } catch (e) {
          // Ignore duplicate constraint violations
        }
      }
    }
  },

  async getAdminNotifications() {
    await ensureReminderTablesExist();
    await this.syncAndProcessDueReminders();

    const rows = await db
      .select({
        notification: adminNotificationsTable,
        loan: loansTable,
        borrowerName: borrowersTable.name,
        borrowerMobile: borrowersTable.mobile,
        reminder: paymentRemindersTable,
      })
      .from(adminNotificationsTable)
      .innerJoin(loansTable, eq(adminNotificationsTable.loanId, loansTable.loanId))
      .innerJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .leftJoin(paymentRemindersTable, eq(adminNotificationsTable.reminderId, paymentRemindersTable.reminderId))
      .orderBy(desc(adminNotificationsTable.createdAt))
      .limit(50);

    return rows.map((r) => {
      const principalNum = Number(r.loan.principal || 0);
      const rateNum = Number(r.loan.interestRate || 0);
      const monthlyInt = Math.round((principalNum * rateNum) / 1000);
      const penaltyNum = Number(r.loan.penaltyAmount || 0);
      const totalPayable = principalNum + monthlyInt + penaltyNum;

      return {
        notificationId: r.notification.notificationId,
        reminderId: r.notification.reminderId,
        loanId: r.loan.loanId,
        borrowerName: r.notification.borrowerName || r.borrowerName,
        borrowerMobile: r.notification.borrowerMobile || r.borrowerMobile,
        reminderType: r.notification.reminderType,
        priority: r.notification.priority,
        title: r.notification.title,
        message: r.notification.message,
        isRead: r.notification.isRead,
        createdAt: r.notification.createdAt,
        dueDate: r.notification.dueDate || r.loan.dueDate,
        currentDate: r.notification.currentDate || format(new Date(), "yyyy-MM-dd"),
        principal: Number(r.notification.principalAmount || principalNum),
        interestRate: Number(r.notification.interestRate || rateNum),
        outstandingBalance: Number(r.notification.outstandingAmount || totalPayable),
        daysRemaining: r.notification.daysRemaining ?? undefined,
        overdueDays: r.notification.overdueDays ?? undefined,
        penaltyAmount: Number(r.notification.penaltyAmount || penaltyNum),
        currentTotalPayable: Number(r.notification.currentTotalPayable || totalPayable),
        loanStatus: r.notification.loanStatus || r.loan.status.toUpperCase(),
        paymentStatus: r.notification.paymentStatus || (r.loan.status === "closed" ? "PAID" : "UNPAID"),
        isContacted: r.reminder?.isContacted || false,
        contactedAt: r.reminder?.contactedAt || null,
        reminderNotes: r.reminder?.notes || null,
      };
    });
  },

  async markNotificationRead(notificationId: string) {
    await ensureReminderTablesExist();
    await db
      .update(adminNotificationsTable)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(adminNotificationsTable.notificationId, notificationId));
  },

  async markAllNotificationsRead() {
    await ensureReminderTablesExist();
    await db
      .update(adminNotificationsTable)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(adminNotificationsTable.isRead, false));
  },

  async markReminderContacted(reminderId: string, notes?: string) {
    await ensureReminderTablesExist();
    await db
      .update(paymentRemindersTable)
      .set({
        isContacted: true,
        contactedAt: new Date(),
        notes: notes || null,
        status: "contacted",
        updatedAt: new Date(),
      })
      .where(eq(paymentRemindersTable.reminderId, reminderId));
  },

  async addReminderNote(reminderId: string, notes: string) {
    await ensureReminderTablesExist();
    await db
      .update(paymentRemindersTable)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(eq(paymentRemindersTable.reminderId, reminderId));
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
