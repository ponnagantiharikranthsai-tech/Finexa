"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  CheckCircle2,
  FileText,
  Volume2,
  VolumeX,
  ShieldCheck,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getAdminNotificationsAction,
  markNotificationCompletedAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  markReminderContactedAction,
  addReminderNoteAction,
} from "@/features/notifications/actions/payment-reminders.action";

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

// Play a short, professional, non-intrusive 2-tone chime using Web Audio API
function playNotificationChime() {
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
    // Ignore audio autoplay restrictions
  }
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Note Modal State
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [activeReminderId, setActiveReminderId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // Load Preferences & Push Permission
  useEffect(() => {
    try {
      const savedSound = localStorage.getItem("finexa_sound_enabled");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");

      if (typeof window !== "undefined" && "Notification" in window) {
        setPushPermission(Notification.permission);
      }
    } catch (e) {}
  }, []);

  // Fetch Notifications
  const loadNotifications = () => {
    startTransition(async () => {
      const res = await getAdminNotificationsAction();
      if (res.success && res.data) {
        const items = res.data as AdminNotificationItem[];
        const hasNewUnread = items.some((item) => !item.isRead);
        setNotifications(items);

        if (hasNewUnread && soundEnabled) {
          playNotificationChime();
        }
      }
    });
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Auto-sync every 30s
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem("finexa_sound_enabled", String(next));
    } catch (e) {}
    toast.info(`Notification Sound: ${next ? "ON 🔊" : "OFF 🔇"}`);
  };

  const requestPushPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser push notifications are not supported on this device.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPushPermission(result);
      if (result === "granted") {
        toast.success("Push notifications enabled! You will receive loan reminders.");
        new Notification("FINEXA Payment Reminders", {
          body: "Push notification subscription active for FINEXA Admin.",
          icon: "/logo-icon.png",
        });
      } else {
        toast.error("Push notification permission denied.");
      }
    } catch (e) {
      toast.error("Unable to request push notification permission.");
    }
  };

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === id ? { ...n, isRead: true } : n))
    );
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success("All notifications marked as read.");
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const handleMarkCompleted = (item: AdminNotificationItem) => {
    // 1. Immediately remove from UI active list
    setNotifications((prev) => prev.filter((n) => n.notificationId !== item.notificationId));
    toast.success(`Reminder for ${item.borrowerName} marked as completed.`);

    // 2. Persist completion in DB
    startTransition(async () => {
      await markNotificationCompletedAction(item.dedupKey || item.notificationId);
    });
  };

  const handleMarkContacted = (reminderId: string, name: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.reminderId === reminderId ? { ...n, isContacted: true } : n))
    );
    toast.success(`Contacted status updated for ${name}`);
    startTransition(async () => {
      await markReminderContactedAction(reminderId);
    });
  };

  const handleSaveNote = () => {
    if (!activeReminderId || !noteText.trim()) return;
    const textToSave = noteText.trim();
    setNotifications((prev) =>
      prev.map((n) =>
        n.reminderId === activeReminderId ? { ...n, reminderNotes: textToSave } : n
      )
    );
    toast.success("Admin note saved.");
    setNoteModalOpen(false);
    setNoteText("");
    startTransition(async () => {
      await addReminderNoteAction(activeReminderId, textToSave);
    });
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          type="button"
          className="relative p-2 rounded-full hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors fx-pressable focus:outline-hidden"
          title="Loan Payment Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-xs animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[360px] sm:w-[420px] p-0 rounded-2xl shadow-2xl border border-border bg-card/95 backdrop-blur-xl z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground leading-none">Payment Reminders</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {notifications.length} active alert{notifications.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className="p-1.5 rounded-lg hover:bg-accent/30 text-muted-foreground hover:text-foreground transition-colors fx-pressable"
                title={soundEnabled ? "Mute sound" : "Enable sound"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors fx-pressable"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Browser Push Permission Banner */}
          {pushPermission === "default" && (
            <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="font-medium text-[11px]">Enable browser push notifications</span>
              </div>
              <button
                type="button"
                onClick={requestPushPermission}
                className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-bold fx-pressable shadow-xs"
              >
                Enable
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-border/30">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/60" />
                <p className="text-sm font-semibold text-foreground">All Clear!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending loan payment reminders right now.</p>
              </div>
            ) : (
              notifications.map((item) => {
                let badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
                if (item.priority === "amber") {
                  badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                } else if (item.priority === "red") {
                  badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
                }

                return (
                  <div
                    key={item.notificationId}
                    className={`p-3.5 transition-colors ${
                      item.isRead ? "bg-card hover:bg-accent/20" : "bg-primary/5 hover:bg-primary/10"
                    }`}
                    onClick={() => {
                      if (!item.isRead) handleMarkRead(item.notificationId);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                        {item.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-foreground mb-1">{item.borrowerName}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2.5">{item.message}</p>

                    {/* Rich Loan Breakdown Panel */}
                    <div className="mb-3 p-2.5 rounded-xl bg-secondary/40 border border-border/40 text-[11px] space-y-1">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
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
                          <strong className="text-primary">₹{(item.currentTotalPayable || item.outstandingBalance)?.toLocaleString("en-IN")}</strong>
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
                    </div>

                    {/* Quick Actions Row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/30">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkCompleted(item);
                        }}
                        className="flex-1 min-w-[130px] h-7 px-2.5 flex items-center justify-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold transition-colors border border-emerald-500/20 shadow-xs fx-pressable"
                        title="Mark Reminder as Completed"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>✓ Mark as Completed</span>
                      </button>

                      <a
                        href={`https://wa.me/91${item.borrowerMobile.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          `Hi ${item.borrowerName}, payment reminder for your FINEXA loan. Amount Payable: Rs. ${(item.currentTotalPayable || item.outstandingBalance).toLocaleString("en-IN")}, Due Date: ${item.dueDate}. Thank you.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 px-2.5 flex items-center justify-center gap-1 rounded-lg bg-secondary hover:bg-accent/40 text-foreground text-[11px] font-semibold transition-colors border border-border/40"
                        title="WhatsApp Message"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        <span>Message</span>
                      </a>

                      <Link
                        href={`/loans/${item.loanId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                        }}
                        className="h-7 px-2.5 flex items-center justify-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold transition-colors border border-primary/20"
                        title="View Loan Details"
                      >
                        <span>View Loan</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-secondary/30 border-t border-border/40 text-center">
            <Link
              href="/loan-management"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Manage All Loans</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      {/* Admin Note Dialog */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Reminder Note</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="e.g. Borrower promised to pay by Friday 5 PM via UPI..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              className="text-xs"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setNoteModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNote}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold"
            >
              Save Note
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
