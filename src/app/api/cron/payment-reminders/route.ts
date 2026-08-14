import { NextResponse } from "next/server";
import { paymentReminderRepository } from "@/features/notifications/repository/payment-reminder.repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const headerSecret = request.headers.get("x-cron-secret");

    const cronSecret = process.env.CRON_SECRET || "finexa_local_cron_secret_key_2026";

    if (secret !== cronSecret && headerSecret !== cronSecret && process.env.NODE_ENV === "production") {
      return NextResponse.json({ success: false, error: "Unauthorized cron request" }, { status: 401 });
    }

    const notifications = await paymentReminderRepository.getAdminNotifications();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      activeNotificationsCount: notifications.length,
      notifications: notifications.map((n) => ({
        loanId: n.loanId,
        borrowerName: n.borrowerName,
        reminderType: n.reminderType,
        title: n.title,
        dueDate: n.dueDate,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed cron execution" }, { status: 500 });
  }
}
