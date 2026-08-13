"use server";

import { paymentReminderRepository, ReminderScheduleOptions } from "../repository/payment-reminder.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function getAdminNotificationsAction(): Promise<ActionResult<any[]>> {
  try {
    await requireAuth();
    const notifications = await paymentReminderRepository.getAdminNotifications();
    return { success: true, data: notifications };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch admin notifications" };
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
