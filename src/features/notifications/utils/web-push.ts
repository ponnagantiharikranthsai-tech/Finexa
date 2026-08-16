import webpush from "web-push";
import { db } from "@/db/client";
import { pushSubscriptionsTable, pushedNotificationKeysTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export function getVapidPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    "BMMwceYHROJAXOTI9c5xai1_5bQIgc-uZPf0f1YJc1xk4IE47c7Hy2FDOnAjHTv1aN-Ilzv3Ce1Ub86pdkImhcc"
  );
}

export function getVapidPrivateKey(): string {
  return (
    process.env.VAPID_PRIVATE_KEY ||
    "Vu5l-LbDkagAhtRDh7NfR5f-V_jKIRkNgo7LPL2jt5c"
  );
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT || "mailto:admin@finexa.app";
}

let isVapidInitialized = false;

function initVapid() {
  const pub = getVapidPublicKey();
  const priv = getVapidPrivateKey();
  const sub = getVapidSubject();

  if (!pub || !priv) {
    console.warn("[VAPID INIT] VAPID public or private key missing.");
    return false;
  }

  try {
    webpush.setVapidDetails(sub, pub, priv);
    isVapidInitialized = true;
    return true;
  } catch (e) {
    console.error("[VAPID INIT ERROR] Error setting VAPID details:", e);
    return false;
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
      badge: "/badge.png",
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
    console.warn("[WEB PUSH CANCELLED] VAPID initialization failed.");
    return false;
  }

  try {
    // 1. Check if this dedupKey was already pushed to prevent duplicate Web Push notifications
    const existingPush = await db
      .select()
      .from(pushedNotificationKeysTable)
      .where(eq(pushedNotificationKeysTable.dedupKey, dedupKey));

    if (existingPush.length > 0) {
      console.log(`[WEB PUSH DEDUP] Notification with key ${dedupKey} already pushed.`);
      return false;
    }

    // 2. Fetch all registered active push subscriptions
    const subscriptions = await db.select().from(pushSubscriptionsTable);
    if (subscriptions.length === 0) {
      console.warn("[WEB PUSH NOTICE] No push subscriptions found in database.");
      return false;
    }

    // Mark as pushed in DB immediately to prevent duplicate sends
    await db
      .insert(pushedNotificationKeysTable)
      .values({ dedupKey, pushedAt: new Date() })
      .onConflictDoNothing();

    const pushPayloadString = JSON.stringify({
      badge: "/badge.png",
      ...payload,
    });

    let successCount = 0;
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
        successCount++;
      } catch (err: any) {
        console.error(`[WEB PUSH ERROR] Endpoint ${sub.endpoint.slice(0, 30)}... failed:`, err.statusCode || err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
        }
      }
    }

    console.log(`[WEB PUSH COMPLETED] Pushed alert ${dedupKey} to ${successCount}/${subscriptions.length} devices.`);
    return successCount > 0;
  } catch (err: any) {
    console.error("Error sending Web Push notification:", err.message);
    return false;
  }
}
