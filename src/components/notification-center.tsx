"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getAdminNotificationsAction } from "@/features/notifications/actions/payment-reminders.action";

export type AdminNotificationItem = {
  notificationId: string;
  reminderId?: string | null;
  loanId: string;
  dedupKey?: string;
  borrowerName: string;
  borrowerMobile: string;
  reminderType?: string;
  priority: string; // 'blue', 'amber', 'red'
  title: string;
  message: string;
  isRead: boolean;
  isCompleted?: boolean;
  createdAt: string;
  dueDate: string;
  currentDate?: string;
  principal: number;
  interestRate?: number;
  outstandingBalance: number;
  daysRemaining?: number;
  overdueDays?: number;
  penaltyAmount?: number;
  currentTotalPayable?: number;
  loanStatus?: string;
  paymentStatus?: string;
  isContacted?: boolean;
  contactedAt?: string | null;
  reminderNotes?: string | null;
};

// Format ISO/YYYY-MM-DD date to "15 August 2026"
export function formatDateVerbose(dateInput: any): string {
  if (!dateInput) return "";
  try {
    let year: number, month: number, day: number;
    if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput.trim())) {
      const parts = dateInput.trim().substring(0, 10).split("-");
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
    const realMonths = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${day} ${realMonths[month]} ${year}`;
  } catch (e) {
    return String(dateInput);
  }
}

// Generate dynamic borrower payment reminder message based on loan cycle
export function generateBorrowerReminderMessage(item: AdminNotificationItem): {
  title: string;
  body: string;
} {
  const name = item.borrowerName || "Borrower";
  const formattedDueDate = formatDateVerbose(item.dueDate);
  const loanAmt = item.principal ? `₹${Number(item.principal).toLocaleString("en-IN")}` : null;
  const payableVal = item.currentTotalPayable || item.outstandingBalance || item.principal || 0;
  const payableAmt = `₹${Number(payableVal).toLocaleString("en-IN")}`;

  const reminderType = item.reminderType || "";
  const daysRemaining = item.daysRemaining ?? 0;
  const overdueDays = item.overdueDays ?? (daysRemaining < 0 ? Math.abs(daysRemaining) : 0);

  // CYCLE 4: OVERDUE
  if (reminderType === "overdue" || (daysRemaining < 0 && overdueDays > 0)) {
    const overdueText = `${overdueDays} ${overdueDays === 1 ? "day" : "days"}`;
    const body = `Hello ${name},

Your Finexa loan payment was due on ${formattedDueDate}.

Your payment is currently overdue by ${overdueText}.

${loanAmt ? `Loan Amount: ${loanAmt}\n` : ""}Current Total Payable: ${payableAmt}

Please arrange the payment at the earliest.

Thank you,
Finexa
Smart Loan Management`;

    return { title: "Payment Overdue", body };
  }

  // CYCLE 1, 2, 3: 10-DAY, 3-DAY, DUE TODAY
  let dueDateSentence = `Your payment is due on ${formattedDueDate}.`;
  if (reminderType === "due_today" || daysRemaining === 0) {
    dueDateSentence = `Your payment is due today, ${formattedDueDate}.`;
  }

  const body = `Hello ${name},

This is a reminder from Finexa regarding your loan payment.

${dueDateSentence}

${loanAmt ? `Loan Amount: ${loanAmt}\n` : ""}Total Payable: ${payableAmt}
Due Date: ${formattedDueDate}

Please arrange the payment before the due date.

Thank you,
Finexa
Smart Loan Management`;

  return {
    title: reminderType === "due_today" ? "Payment Due Today" : "Payment Reminder",
    body,
  };
}

// Play a short 0.35s non-intrusive chime ONCE (never loops)
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.1);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Ignore audio restrictions
  }
}

// Header Notification Bell Component — Navigates to /notifications page
export function NotificationCenter() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const checkUnread = () => {
      startTransition(async () => {
        const res = await getAdminNotificationsAction();
        if (res.success && res.data) {
          const items = res.data as AdminNotificationItem[];
          setUnreadCount(items.length);
        }
      });
    };

    // Defer initial notification count fetch slightly to prioritize main UI rendering
    const timer = setTimeout(checkUnread, 800);
    const interval = setInterval(checkUnread, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      prefetch={true}
      className="relative p-2 rounded-full hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors fx-pressable flex items-center justify-center"
      title="Payment Notifications & Reminders"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-xs animate-pulse">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
