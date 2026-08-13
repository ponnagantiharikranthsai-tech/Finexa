import { db } from "@/db/client";
import { paymentRemindersTable, adminNotificationsTable, loansTable, borrowersTable } from "@/db/schema";
import { eq, and, lte, gte, desc, sql, inArray } from "drizzle-orm";
import { format, subDays, addDays, parseISO } from "date-fns";

export type ReminderIntervalKey = "10d" | "7d" | "3d" | "1d" | "due_date" | "overdue";

export type ReminderScheduleOptions = {
  enabledIntervals: Record<ReminderIntervalKey, boolean>;
  scheduledTime?: string; // e.g. "10:00"
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
    // Execute DDL safely
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
        priority TEXT NOT NULL DEFAULT 'blue',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_payment_reminders_loan_status ON payment_reminders(loan_id, status);
      CREATE INDEX IF NOT EXISTS idx_payment_reminders_scheduled_date ON payment_reminders(scheduled_date, status);
      CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read, created_at);
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

    // Delete any existing pending reminders for this loan
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

    // Fetch existing pending reminders
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

    // Current date in YYYY-MM-DD
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Fetch all active loans with borrowers
    const activeLoans = await db
      .select({
        loan: loansTable,
        borrowerName: borrowersTable.name,
        borrowerMobile: borrowersTable.mobile,
      })
      .from(loansTable)
      .innerJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .where(inArray(loansTable.status, ["submitted", "active", "overdue", "extended"]));

    const activeLoanIds = activeLoans.map((item) => item.loan.loanId);
    if (activeLoanIds.length === 0) return;

    // Fetch due pending reminders
    const dueReminders = await db
      .select()
      .from(paymentRemindersTable)
      .where(
        and(
          inArray(paymentRemindersTable.loanId, activeLoanIds),
          eq(paymentRemindersTable.status, "pending"),
          lte(paymentRemindersTable.scheduledDate, todayStr)
        )
      );

    const loanMap = new Map(activeLoans.map((item) => [item.loan.loanId, item]));

    for (const rem of dueReminders) {
      const loanData = loanMap.get(rem.loanId);
      if (!loanData) continue;

      const { loan, borrowerName } = loanData;
      const principalNum = Number(loan.principal || 0);
      const rateNum = Number(loan.interestRate || 0);
      const monthlyInt = Math.round((principalNum * rateNum) / 1000);
      const totalPayable = principalNum + monthlyInt + Number(loan.penaltyAmount || 0);

      let priority = "blue";
      let title = "PAYMENT REMINDER";
      let message = `${borrowerName}'s loan payment is upcoming.`;

      switch (rem.intervalKey) {
        case "10d":
          priority = "blue";
          title = "🔵 PAYMENT DUE IN 10 DAYS";
          message = `${borrowerName}'s loan payment is due in 10 days (Due: ${loan.dueDate}). Total: Rs. ${totalPayable.toLocaleString("en-IN")}.`;
          break;
        case "7d":
          priority = "blue";
          title = "🔵 PAYMENT DUE IN 7 DAYS";
          message = `${borrowerName}'s loan payment is due in 7 days (Due: ${loan.dueDate}). Total: Rs. ${totalPayable.toLocaleString("en-IN")}.`;
          break;
        case "3d":
          priority = "amber";
          title = "🟡 PAYMENT DUE IN 3 DAYS";
          message = `${borrowerName}'s loan payment is due in 3 days (Due: ${loan.dueDate}). Follow up with borrower. Total: Rs. ${totalPayable.toLocaleString("en-IN")}.`;
          break;
        case "1d":
          priority = "amber";
          title = "🟠 PAYMENT DUE TOMORROW";
          message = `${borrowerName}'s loan payment is due tomorrow (Due: ${loan.dueDate}). Final reminder. Total: Rs. ${totalPayable.toLocaleString("en-IN")}.`;
          break;
        case "due_date":
          priority = "red";
          title = "🔴 PAYMENT DUE TODAY";
          message = `${borrowerName}'s loan payment is due today! Total: Rs. ${totalPayable.toLocaleString("en-IN")}.`;
          break;
        case "overdue":
          priority = "red";
          title = "🔴 OVERDUE PAYMENT";
          message = `${borrowerName}'s loan payment is overdue! Due date was ${loan.dueDate}. Follow up immediately.`;
          break;
      }

      // Insert into admin_notifications
      await db.insert(adminNotificationsTable).values({
        reminderId: rem.reminderId,
        loanId: rem.loanId,
        priority,
        title,
        message,
        isRead: false,
      });

      // Mark reminder as sent
      await db
        .update(paymentRemindersTable)
        .set({
          status: "sent",
          updatedAt: new Date(),
        })
        .where(eq(paymentRemindersTable.reminderId, rem.reminderId));
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

      return {
        notificationId: r.notification.notificationId,
        reminderId: r.notification.reminderId,
        loanId: r.loan.loanId,
        borrowerName: r.borrowerName,
        borrowerMobile: r.borrowerMobile,
        priority: r.notification.priority,
        title: r.notification.title,
        message: r.notification.message,
        isRead: r.notification.isRead,
        createdAt: r.notification.createdAt,
        dueDate: r.loan.dueDate,
        principal: principalNum,
        outstandingBalance: principalNum + monthlyInt + Number(r.loan.penaltyAmount || 0),
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
