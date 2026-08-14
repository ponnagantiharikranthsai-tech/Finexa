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
  RefreshCw,
  Clock,
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  getAdminNotificationsAction,
  markNotificationCompletedAction,
  markAllNotificationsReadAction,
  savePushSubscriptionAction,
} from "@/features/notifications/actions/payment-reminders.action";
import {
  generateBorrowerReminderMessage,
  playNotificationChime,
  type AdminNotificationItem,
} from "@/components/notification-center";

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
  const [activeTab, setActiveTab] = useState<"ALL" | "10_DAYS" | "3_DAYS" | "DUE_TODAY" | "OVERDUE">("ALL");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Message Modal State
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedNotifForMsg, setSelectedNotifForMsg] = useState<AdminNotificationItem | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Sound preference load
  useEffect(() => {
    try {
      const savedSound = localStorage.getItem("finexa_sound_enabled");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");

      if (typeof window !== "undefined" && "Notification" in window) {
        setPushPermission(Notification.permission);
      }
    } catch (e) {}
  }, []);

  const loadNotifications = (triggerSoundCheck = false) => {
    startTransition(async () => {
      const res = await getAdminNotificationsAction();
      if (res.success && res.data) {
        const items = res.data as AdminNotificationItem[];
        setNotifications(items);

        // Zero-Loop Sound System: Play sound ONCE ONLY if genuinely NEW notification arrived
        if (triggerSoundCheck && soundEnabled && items.length > 0) {
          try {
            const deliveredRaw = sessionStorage.getItem("finexa_delivered_notif_keys");
            const deliveredSet = new Set<string>(deliveredRaw ? JSON.parse(deliveredRaw) : []);

            const newKeys = items.map((i) => i.dedupKey || i.notificationId);
            const hasGenuinelyNew = newKeys.some((k) => !deliveredSet.has(k));

            if (hasGenuinelyNew) {
              playNotificationChime();
              newKeys.forEach((k) => deliveredSet.add(k));
              sessionStorage.setItem("finexa_delivered_notif_keys", JSON.stringify(Array.from(deliveredSet)));
            }
          } catch (e) {}
        }
      }
    });
  };

  useEffect(() => {
    loadNotifications(true);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem("finexa_sound_enabled", String(next));
    } catch (e) {}
    toast.info(`Notification Sound: ${next ? "ON 🔊" : "OFF 🔇"}`);
  };

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

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast.error("VAPID public key configuration missing.");
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
          toast.success("Web Push Notifications enabled! Receive alerts even when FINEXA is closed.");
        } else {
          toast.error("Failed to store push subscription.");
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
    setNotifications([]);
    toast.success("All notifications marked as read/completed.");
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

  // Counters
  const overdueCount = notifications.filter((n) => n.reminderType === "overdue" || (n.daysRemaining !== undefined && n.daysRemaining < 0)).length;
  const dueTodayCount = notifications.filter((n) => n.reminderType === "due_today" || n.daysRemaining === 0).length;
  const threeDaysCount = notifications.filter((n) => n.reminderType === "3d" || n.daysRemaining === 3).length;
  const tenDaysCount = notifications.filter((n) => n.reminderType === "10d" || n.daysRemaining === 10).length;

  // Filtered List
  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === "OVERDUE") return item.reminderType === "overdue" || (item.daysRemaining !== undefined && item.daysRemaining < 0);
    if (activeTab === "DUE_TODAY") return item.reminderType === "due_today" || item.daysRemaining === 0;
    if (activeTab === "3_DAYS") return item.reminderType === "3d" || item.daysRemaining === 3;
    if (activeTab === "10_DAYS") return item.reminderType === "10d" || item.daysRemaining === 10;
    return true;
  });

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-3xl bg-card border border-border shadow-xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href="/loan-management"
              className="p-2 rounded-xl border border-border/60 hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors fx-pressable shrink-0"
              title="Back to Loan Management"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span>Payment Reminders & Notifications</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stay updated with upcoming and overdue loan payments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            className="p-2.5 rounded-xl border border-border/60 hover:bg-accent/40 text-foreground transition-colors fx-pressable flex items-center gap-1.5 text-xs font-semibold"
            title={soundEnabled ? "Mute notification sound" : "Enable notification sound"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            <span>{soundEnabled ? "Sound ON" : "Sound OFF"}</span>
          </button>

          <button
            type="button"
            onClick={() => loadNotifications(false)}
            className="p-2.5 rounded-xl border border-border/60 hover:bg-accent/40 text-foreground transition-colors fx-pressable flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh notifications"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="px-3.5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors fx-pressable flex items-center gap-1.5"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Web Push Permission Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20 text-primary shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground">Browser Push Notifications</h3>
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
              Receive OS & browser notifications even when FINEXA is closed.
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
            <span>{isSubscribing ? "Enabling..." : "Enable Push Notifications"}</span>
          </button>
        )}
      </div>

      {/* Counter Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-card border border-border/60 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Reminders</p>
          <p className="text-xl font-black text-foreground">{notifications.length}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">Overdue</p>
          <p className="text-xl font-black text-red-500">{overdueCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">Due Today</p>
          <p className="text-xl font-black text-red-500">{dueTodayCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">3 Days Left</p>
          <p className="text-xl font-black text-amber-500">{threeDaysCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider">10 Days Left</p>
          <p className="text-xl font-black text-blue-500">{tenDaysCount}</p>
        </div>
      </div>

      {/* Horizontally Scrollable Pill Filter Bar */}
      <div className="w-full relative">
        <div className="flex items-center gap-2.5 overflow-x-auto overflow-y-hidden flex-nowrap py-1 scrollbar-none touch-pan-x -mx-1 px-1">
          {/* ALL */}
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`h-11 px-5 rounded-full text-xs font-bold transition-all duration-200 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 fx-pressable ${
              activeTab === "ALL"
                ? "fx-brand-gradient text-white shadow-lg shadow-amber-500/20 border border-amber-400/30 font-black scale-[1.02]"
                : "bg-card/90 hover:bg-accent/40 text-muted-foreground hover:text-foreground border border-border/60"
            }`}
          >
            <span>All</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "ALL"
                  ? "bg-white/20 text-white"
                  : "bg-secondary text-foreground border border-border/40"
              }`}
            >
              {notifications.length}
            </span>
          </button>

          {/* 10 DAYS */}
          <button
            type="button"
            onClick={() => setActiveTab("10_DAYS")}
            className={`h-11 px-5 rounded-full text-xs font-bold transition-all duration-200 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 fx-pressable ${
              activeTab === "10_DAYS"
                ? "fx-brand-gradient text-white shadow-lg shadow-amber-500/20 border border-amber-400/30 font-black scale-[1.02]"
                : "bg-card/90 hover:bg-accent/40 text-muted-foreground hover:text-foreground border border-border/60"
            }`}
          >
            <span>10 Days</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "10_DAYS"
                  ? "bg-white/20 text-white"
                  : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
              }`}
            >
              {tenDaysCount}
            </span>
          </button>

          {/* 3 DAYS */}
          <button
            type="button"
            onClick={() => setActiveTab("3_DAYS")}
            className={`h-11 px-5 rounded-full text-xs font-bold transition-all duration-200 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 fx-pressable ${
              activeTab === "3_DAYS"
                ? "fx-brand-gradient text-white shadow-lg shadow-amber-500/20 border border-amber-400/30 font-black scale-[1.02]"
                : "bg-card/90 hover:bg-accent/40 text-muted-foreground hover:text-foreground border border-border/60"
            }`}
          >
            <span>3 Days</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "3_DAYS"
                  ? "bg-white/20 text-white"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}
            >
              {threeDaysCount}
            </span>
          </button>

          {/* DUE TODAY */}
          <button
            type="button"
            onClick={() => setActiveTab("DUE_TODAY")}
            className={`h-11 px-5 rounded-full text-xs font-bold transition-all duration-200 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 fx-pressable ${
              activeTab === "DUE_TODAY"
                ? "fx-brand-gradient text-white shadow-lg shadow-amber-500/20 border border-amber-400/30 font-black scale-[1.02]"
                : "bg-card/90 hover:bg-accent/40 text-muted-foreground hover:text-foreground border border-border/60"
            }`}
          >
            <span>Due Today</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "DUE_TODAY"
                  ? "bg-white/20 text-white"
                  : "bg-red-500/10 text-red-500 border border-red-500/20"
              }`}
            >
              {dueTodayCount}
            </span>
          </button>

          {/* OVERDUE */}
          <button
            type="button"
            onClick={() => setActiveTab("OVERDUE")}
            className={`h-11 px-5 rounded-full text-xs font-bold transition-all duration-200 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 fx-pressable ${
              activeTab === "OVERDUE"
                ? "fx-brand-gradient text-white shadow-lg shadow-amber-500/20 border border-amber-400/30 font-black scale-[1.02]"
                : "bg-card/90 hover:bg-accent/40 text-muted-foreground hover:text-foreground border border-border/60"
            }`}
          >
            <span>Overdue</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "OVERDUE"
                  ? "bg-white/20 text-white"
                  : "bg-red-500/10 text-red-500 border border-red-500/20"
              }`}
            >
              {overdueCount}
            </span>
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-card border border-border shadow-xl">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/80" />
          <h2 className="text-base font-bold text-foreground">All Clear!</h2>
          <p className="text-xs text-muted-foreground mt-1">
            No active loan payment reminders match the selected filter right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotifications.map((item) => {
            let badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
            let displayHeaderTitle = "PAYMENT DUE IN 10 DAYS";

            if (item.reminderType === "overdue" || (item.daysRemaining !== undefined && item.daysRemaining < 0)) {
              badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
              displayHeaderTitle = "PAYMENT OVERDUE";
            } else if (item.reminderType === "due_today" || item.daysRemaining === 0) {
              badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
              displayHeaderTitle = "PAYMENT DUE TODAY";
            } else if (item.reminderType === "3d" || item.daysRemaining === 3) {
              badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
              displayHeaderTitle = "PAYMENT DUE IN 3 DAYS";
            }

            return (
              <div
                key={item.notificationId}
                className="p-5 rounded-2xl border bg-card border-border/60 hover:border-primary/40 transition-all shadow-md space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                    {displayHeaderTitle}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground">{item.borrowerName}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{item.message}</p>
                </div>

                {/* Breakdown Details Grid */}
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
                    <span className="text-muted-foreground">Status:</span>{" "}
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
