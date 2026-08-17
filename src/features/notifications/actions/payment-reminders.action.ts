"use server";

import { paymentReminderRepository, ReminderScheduleOptions } from "../repository/payment-reminder.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

import { getVapidPublicKey, sendTestWebPushNotification } from "../utils/web-push";

export async function getVapidPublicKeyAction(): Promise<ActionResult<{ vapidPublicKey: string }>> {
  try {
    await requireAuth();
    const key = getVapidPublicKey();
    return { success: true, data: { vapidPublicKey: key } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch VAPID public key" };
  }
}

export async function sendTestPushNotificationAction(): Promise<ActionResult<{ count: number }>> {
  try {
    await requireAuth();
    const result = await sendTestWebPushNotification();
    if (result.success) {
      return { success: true, data: { count: result.count } };
    } else {
      return { success: false, error: result.error || "Failed to send test push notification" };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to send test push notification" };
  }
}

let adminNotifCache: { data: any[]; timestamp: number } | null = null;
const NOTIF_CACHE_TTL = 15000; // 15 seconds RAM cache

export async function invalidateAdminNotifCache() {
  adminNotifCache = null;
}

export async function getAdminNotificationsAction(overrideTodayStr?: string): Promise<ActionResult<any[]>> {
  try {
    await requireAuth();

    if (!overrideTodayStr && adminNotifCache && Date.now() - adminNotifCache.timestamp < NOTIF_CACHE_TTL) {
      return { success: true, data: adminNotifCache.data };
    }

    const notifications = await paymentReminderRepository.getAdminNotifications(overrideTodayStr);

    if (!overrideTodayStr) {
      adminNotifCache = { data: notifications, timestamp: Date.now() };
    }

    return { success: true, data: notifications };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch admin notifications" };
  }
}

export async function savePushSubscriptionAction(
  endpoint: string,
  p256dh: string,
  auth: string
): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth();
    await paymentReminderRepository.savePushSubscription(endpoint, p256dh, auth, (user as any)?.id);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save push subscription" };
  }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult<null>> {
  try {
    await requireAuth();
    await paymentReminderRepository.removePushSubscription(endpoint);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to remove push subscription" };
  }
}

export async function markNotificationCompletedAction(dedupKey: string): Promise<ActionResult<null>> {
  try {
    await requireAuth();
    await paymentReminderRepository.markNotificationCompleted(dedupKey);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark notification completed" };
  }
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult<null>> {
  try {
    await requireAuth();
    await paymentReminderRepository.markNotificationRead(notificationId);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark notification read" };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<null>> {
  try {
    await requireAuth();
    await paymentReminderRepository.markAllNotificationsRead();
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark all notifications read" };
  }
}

export async function markReminderContactedAction(
  reminderId: string,
  notes?: string
): Promise<ActionResult<null>> {
  try {
    await requireAuth();
    await paymentReminderRepository.markReminderContacted(reminderId, notes);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark reminder contacted" };
  }
}

export async function addReminderNoteAction(
  reminderId: string,
  notes: string
): Promise<ActionResult<null>> {
  try {
    await requireAuth();
    await paymentReminderRepository.addReminderNote(reminderId, notes);
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add reminder note" };
  }
}

export async function getReminderHistoryAction(loanId: string): Promise<ActionResult<any[]>> {
  try {
    await requireAuth();
    const history = await paymentReminderRepository.getReminderHistoryByLoanId(loanId);
    return { success: true, data: history };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch reminder history" };
  }
}
