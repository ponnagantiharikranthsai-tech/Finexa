import webpush from "web-push";
import { db } from "@/db/client";
import { pushSubscriptionsTable, pushedNotificationKeysTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@finexa.app";

let isVapidConfigured = false;

function initVapid() {
  if (isVapidConfigured) return true;
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured in environment.");
    return false;
  }
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isVapidConfigured = true;
    return true;
  } catch (e) {
    console.error("Error setting VAPID details:", e);
    return false;
  }
}

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

export type WebPushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  loanId?: string;
  tag?: string;
};

export async function sendTestWebPushNotification(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!initVapid()) {
    return { success: false, count: 0, error: "VAPID keys are not configured on the server." };
  }

  try {
    const subscriptions = await db.select().from(pushSubscriptionsTable);
    if (subscriptions.length === 0) {
      return { success: false, count: 0, error: "No active push subscriptions found in database. Please enable push notifications on your device first." };
    }

    const testPayload = JSON.stringify({
      title: "FINEXA Test Push Notification 🔔",
      body: "Web Push notifications are working successfully on your Android device!",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `test-push-${Date.now()}`,
      url: "/notifications",
    });

    let sentCount = 0;
    for (const sub of subscriptions) {
      const pushSubObj = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubObj, testPayload);
        sentCount++;
      } catch (err: any) {
        console.error("Test push send error for endpoint:", sub.endpoint, err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
        }
      }
    }

    if (sentCount > 0) {
      return { success: true, count: sentCount };
    } else {
      return { success: false, count: 0, error: "Push subscriptions exist but sending failed (possibly expired subscriptions cleaned up)." };
    }
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || "Failed to send test push notification" };
  }
}

export async function sendWebPushToAllSubscriptions(
  dedupKey: string,
  payload: WebPushPayload
) {
  if (!initVapid()) {
    return false;
  }

  try {
    // 1. Check if this dedupKey was already pushed to prevent duplicate Web Push notifications
    const existingPush = await db
      .select()
      .from(pushedNotificationKeysTable)
      .where(eq(pushedNotificationKeysTable.dedupKey, dedupKey));

    if (existingPush.length > 0) {
      return false;
    }

    // 2. Fetch all registered active push subscriptions
    const subscriptions = await db.select().from(pushSubscriptionsTable);
    if (subscriptions.length === 0) {
      return false;
    }

    // Mark as pushed in DB immediately to prevent duplicate sends
    await db
      .insert(pushedNotificationKeysTable)
      .values({ dedupKey, pushedAt: new Date() })
      .onConflictDoNothing();

    const pushPayloadString = JSON.stringify({
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      ...payload,
    });

    for (const sub of subscriptions) {
      const pushSubObj = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubObj, pushPayloadString);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
        }
      }
    }

    return true;
  } catch (err: any) {
    console.error("Error sending Web Push notification:", err.message);
    return false;
  }
}
