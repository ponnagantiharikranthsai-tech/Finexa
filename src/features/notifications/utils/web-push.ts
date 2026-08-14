import webpush from "web-push";
import { db } from "@/db/client";
import { pushSubscriptionsTable, pushedNotificationKeysTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@finexa.app";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (e) {
    console.error("Error setting VAPID details:", e);
  }
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

export async function sendWebPushToAllSubscriptions(
  dedupKey: string,
  payload: WebPushPayload
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured. Skipping Web Push notification.");
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

    const pushPayloadString = JSON.stringify(payload);

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
