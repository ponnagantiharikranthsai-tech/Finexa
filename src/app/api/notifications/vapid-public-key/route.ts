import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/features/notifications/utils/web-push";

export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    return NextResponse.json({
      success: true,
      vapidPublicKey: publicKey,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch VAPID public key" },
      { status: 500 }
    );
  }
}
