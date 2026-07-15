import { db } from "@/db/client";
import { notificationsLogTable, type NotificationLog, type InsertNotificationLog } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export class NotificationLogRepository {
  async insert(data: InsertNotificationLog): Promise<void> {
    await db.insert(notificationsLogTable).values(data);
  }

  async findByLoanId(loanId: string): Promise<NotificationLog[]> {
    return db
      .select()
      .from(notificationsLogTable)
      .where(eq(notificationsLogTable.loanId, loanId))
      .orderBy(desc(notificationsLogTable.sentAt));
  }

  async findLastReminderByLoanId(loanId: string): Promise<NotificationLog | null> {
    const [log] = await db
      .select()
      .from(notificationsLogTable)
      .where(
        and(
          eq(notificationsLogTable.loanId, loanId),
          eq(notificationsLogTable.type, "reminder")
        )
      )
      .orderBy(desc(notificationsLogTable.sentAt))
      .limit(1);
    return log || null;
  }

  async getFailedNotifications(): Promise<NotificationLog[]> {
    return db
      .select()
      .from(notificationsLogTable)
      .where(eq(notificationsLogTable.status, "failed"))
      .orderBy(desc(notificationsLogTable.sentAt));
  }
}

export const notificationLogRepository = new NotificationLogRepository();
