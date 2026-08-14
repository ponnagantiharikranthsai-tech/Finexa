"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  Volume2,
  VolumeX,
  FileText,
  Filter,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  getAdminNotificationsAction,
  markNotificationCompletedAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  savePushSubscriptionAction,
} from "@/features/notifications/actions/payment-reminders.action";
import {
  generateBorrowerReminderMessage,
  type AdminNotificationItem,
} from "@/components/notification-center";

// Helper to convert base64 URL to Uint8Array for VAPID key subscription
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "overdue" | "due_today" | "3d" | "10d">("all");
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Message Modal State
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedNotifForMsg, setSelectedNotifForMsg] = useState<AdminNotificationItem | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const loadNotifications = () => {
    startTransition(async () => {
      const res = await getAdminNotificationsAction();
      if (res.success && res.data) {
        setNotifications(res.data as AdminNotificationItem[]);
      }
    });
  };

  useEffect(() => {
    loadNotifications();

    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Web Push Subscription Helper
  const enableWebPush = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Web Push notifications are not supported in this browser environment.");
      return;
    }

    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== "granted") {
        toast.error("Notification permission was denied.");
        setIsSubscribing(false);
        return;
      }

      // Register Service Worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast.error("VAPID public key is missing.");
        setIsSubscribing(false);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subJson = sub.toJSON();
      const endpoint = subJson.endpoint || "";
      const p256dh = subJson.keys?.p256dh || "";
      const auth = subJson.keys?.auth || "";

      if (endpoint && p256dh && auth) {
        const res = await savePushSubscriptionAction(endpoint, p256dh, auth);
        if (res.success) {
          toast.success("Web Push Notifications enabled! You will receive reminders even when FINEXA is closed.");
        } else {
          toast.error("Failed to save push subscription.");
        }
      }
    } catch (err: any) {
      console.error("Web Push registration error:", err);
      toast.error("Unable to enable push notifications: " + (err.message || "Unknown error"));
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleMarkCompleted = (item: AdminNotificationItem) => {
    setNotifications((prev) => prev.filter((n) => n.notificationId !== item.notificationId));
    toast.success(`Reminder for ${item.borrowerName} marked as completed.`);

    startTransition(async () => {
      await markNotificationCompletedAction(item.dedupKey || item.notificationId);
    });
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success("All notifications marked as read.");
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const openMessageModal = (item: AdminNotificationItem) => {
    setSelectedNotifForMsg(item);
    setCopiedSuccess(false);
    setMessageModalOpen(true);
  };

  const currentMsgObj = selectedNotifForMsg
    ? generateBorrowerReminderMessage(selectedNotifForMsg)
    : { title: "Payment Reminder Message", body: "" };

  const handleCopyMessage = async () => {
    if (!currentMsgObj.body) return;
    try {
      await navigator.clipboard.writeText(currentMsgObj.body);
      setCopiedSuccess(true);
      toast.success("Message copied successfully.");
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch (e) {
      toast.error("Failed to copy message.");
    }
  };

  const handleOpenWhatsApp = () => {
    if (!selectedNotifForMsg) return;
    const cleanMobile = selectedNotifForMsg.borrowerMobile?.replace(/[^0-9]/g, "") || "";
    if (!cleanMobile) {
      toast.error("Mobile number unavailable.");
      return;
    }
    const fullMobile = cleanMobile.startsWith("91") ? cleanMobile : `91${cleanMobile}`;
    const url = `https://wa.me/${fullMobile}?text=${encodeURIComponent(currentMsgObj.body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Filtered Items
  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === "overdue") return item.reminderType === "overdue" || (item.daysRemaining !== undefined && item.daysRemaining < 0);
    if (activeTab === "due_today") return item.reminderType === "due_today" || item.daysRemaining === 0;
    if (activeTab === "3d") return item.reminderType === "3d" || item.daysRemaining === 3;
    if (activeTab === "10d") return item.reminderType === "10d" || item.daysRemaining === 10;
    return true;
  });

  const overdueCount = notifications.filter((n) => n.reminderType === "overdue" || (n.daysRemaining !== undefined && n.daysRemaining < 0)).length;
  const dueTodayCount = notifications.filter((n) => n.reminderType === "due_today" || n.daysRemaining === 0).length;
  const threeDaysCount = notifications.filter((n) => n.reminderType === "3d" || n.daysRemaining === 3).length;
  const tenDaysCount = notifications.filter((n) => n.reminderType === "10d" || n.daysRemaining === 10).length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-3xl bg-card border border-border shadow-xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                Payment Reminders & Notifications
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automated Web Push alerts and daily payment reminder logs for FINEXA Admin.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadNotifications}
            className="p-2.5 rounded-xl border border-border/60 hover:bg-accent/40 text-foreground transition-colors fx-pressable flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh notifications"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="px-3.5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors fx-pressable"
            >
              Mark All Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Web Push Permission Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20 text-primary shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground">Browser Web Push Notifications</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  pushPermission === "granted"
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : pushPermission === "denied"
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                }`}
              >
                {pushPermission === "granted" ? "ACTIVE 🟢" : pushPermission === "denied" ? "BLOCKED 🔴" : "NOT CONFIGURED 🔔"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Receive OS & browser push alerts when payments are 10 days left, 3 days left, due today, or overdue — even when FINEXA is closed.
            </p>
          </div>
        </div>

        {pushPermission !== "granted" && (
          <button
            type="button"
            onClick={enableWebPush}
            disabled={isSubscribing}
            className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 text-xs font-bold shadow-md transition-all fx-pressable shrink-0 flex items-center justify-center gap-1.5"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>{isSubscribing ? "Enabling..." : "Enable Web Push"}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap fx-pressable ${
            activeTab === "all"
              ? "bg-primary text-white shadow-md"
              : "bg-card hover:bg-accent/40 text-muted-foreground border border-border/50"
          }`}
        >
          All Notifications ({notifications.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("overdue")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap fx-pressable flex items-center gap-1.5 ${
            activeTab === "overdue"
              ? "bg-red-500 text-white shadow-md"
              : "bg-card hover:bg-accent/40 text-muted-foreground border border-border/50"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Overdue ({overdueCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("due_today")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap fx-pressable flex items-center gap-1.5 ${
            activeTab === "due_today"
              ? "bg-red-500 text-white shadow-md"
              : "bg-card hover:bg-accent/40 text-muted-foreground border border-border/50"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Due Today ({dueTodayCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("3d")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap fx-pressable flex items-center gap-1.5 ${
            activeTab === "3d"
              ? "bg-amber-500 text-white shadow-md"
              : "bg-card hover:bg-accent/40 text-muted-foreground border border-border/50"
          }`}
        >
          <span>3 Days Left ({threeDaysCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("10d")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap fx-pressable flex items-center gap-1.5 ${
            activeTab === "10d"
              ? "bg-blue-500 text-white shadow-md"
              : "bg-card hover:bg-accent/40 text-muted-foreground border border-border/50"
          }`}
        >
          <span>10 Days Left ({tenDaysCount})</span>
        </button>
      </div>

      {/* Notifications Grid List */}
      {filteredNotifications.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-card border border-border shadow-xl">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/80" />
          <h2 className="text-base font-bold text-foreground">All Clear!</h2>
          <p className="text-xs text-muted-foreground mt-1">
            No active loan payment reminders match the selected tab right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotifications.map((item) => {
            let badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
            if (item.priority === "amber") {
              badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
            } else if (item.priority === "red") {
              badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
            }

            return (
              <div
                key={item.notificationId}
                className={`p-5 rounded-2xl border transition-all shadow-md space-y-3 ${
                  item.isRead
                    ? "bg-card hover:bg-accent/20 border-border/60"
                    : "bg-primary/5 hover:bg-primary/10 border-primary/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                    {item.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground">{item.borrowerName}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{item.message}</p>
                </div>

                {/* Rich Breakdown Table */}
                <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 text-xs grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Mobile:</span>{" "}
                    <strong className="text-foreground">{item.borrowerMobile}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Due Date:</span>{" "}
                    <strong className="text-foreground">{item.dueDate}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loan Amount:</span>{" "}
                    <strong className="text-foreground">₹{item.principal?.toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Payable:</span>{" "}
                    <strong className="text-primary font-bold">
                      ₹{(item.currentTotalPayable || item.outstandingBalance)?.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loan Status:</span>{" "}
                    <strong className="text-emerald-500 uppercase">{item.loanStatus || "ACTIVE"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment Status:</span>{" "}
                    <strong className="text-foreground">{item.paymentStatus || "UNPAID"}</strong>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => handleMarkCompleted(item)}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors border border-emerald-500/20 shadow-xs fx-pressable flex items-center justify-center gap-1.5"
                    title="Mark Reminder as Completed"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>✓ Mark as Completed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openMessageModal(item)}
                    className="py-2 px-3 rounded-xl bg-secondary hover:bg-accent/40 text-foreground text-xs font-semibold transition-colors border border-border/40 fx-pressable flex items-center justify-center gap-1.5"
                    title="Open Payment Reminder Message"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <span>Message</span>
                  </button>

                  <Link
                    href={`/loans/${item.loanId}`}
                    className="py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors border border-primary/20 flex items-center justify-center gap-1.5"
                    title="View Loan Details"
                  >
                    <span>View Loan</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Reminder Message Modal */}
      <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl bg-card border border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>{currentMsgObj.title || "Payment Reminder Message"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-3">
            <div className="p-4 rounded-xl bg-secondary/60 border border-border/50 text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground max-h-[340px] overflow-y-auto select-all shadow-inner">
              {currentMsgObj.body}
            </div>
            {copiedSuccess && (
              <p className="text-[11px] font-semibold text-emerald-500 mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Message copied successfully.
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setMessageModalOpen(false)}
              className="px-3.5 py-2 rounded-xl border border-border/60 hover:bg-accent/40 text-foreground text-xs font-semibold transition-colors fx-pressable"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleCopyMessage}
              className="px-3.5 py-2 rounded-xl bg-secondary hover:bg-accent/50 text-foreground text-xs font-bold transition-colors border border-border/50 flex items-center justify-center gap-1.5 fx-pressable"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>{copiedSuccess ? "Copied!" : "Copy Message"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!selectedNotifForMsg?.borrowerMobile}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 fx-pressable"
              title={!selectedNotifForMsg?.borrowerMobile ? "Mobile number unavailable." : "Open WhatsApp with pre-filled message"}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Open WhatsApp</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
