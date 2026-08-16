import { NextResponse } from "next/server";
import { paymentReminderRepository } from "@/features/notifications/repository/payment-reminder.repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { endpoint, keys } = body;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription payload. Required: endpoint, keys.p256dh, keys.auth" },
        { status: 400 }
      );
    }

    await paymentReminderRepository.savePushSubscription(endpoint, p256dh, auth);

    return NextResponse.json({
      success: true,
      message: "Push subscription stored successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save push subscription" },
      { status: 500 }
    );
  }
}
