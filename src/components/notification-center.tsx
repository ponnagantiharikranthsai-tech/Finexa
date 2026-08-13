"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Phone,
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
  markNotificationReadAction,
  markAllNotificationsReadAction,
  markReminderContactedAction,
  addReminderNoteAction,
} from "@/features/notifications/actions/payment-reminders.action";

export type AdminNotificationItem = {
  notificationId: string;
  reminderId?: string | null;
  loanId: string;
  borrowerName: string;
  borrowerMobile: string;
  reminderType?: string;
  priority: string; // 'blue', 'amber', 'red'
  title: string;
  message: string;
  isRead: boolean;
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
  isContacted: boolean;
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

  const handleMarkRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
    );
    await markNotificationReadAction(notificationId);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsReadAction();
    toast.success("All notifications marked as read.");
  };

  const handleMarkContacted = async (reminderId: string | null | undefined, borrowerName: string) => {
    if (!reminderId) return;
    setNotifications((prev) =>
      prev.map((n) => (n.reminderId === reminderId ? { ...n, isContacted: true } : n))
    );
    await markReminderContactedAction(reminderId);
    toast.success(`Marked as contacted: ${borrowerName}`);
  };

  const handleSaveNote = async () => {
    if (!activeReminderId || !noteText.trim()) return;
    const notesToSave = noteText.trim();
    await addReminderNoteAction(activeReminderId, notesToSave);

    setNotifications((prev) =>
      prev.map((n) => (n.reminderId === activeReminderId ? { ...n, reminderNotes: notesToSave, isContacted: true } : n))
    );

    toast.success("Reminder note saved successfully.");
    setNoteModalOpen(false);
    setNoteText("");
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (open) loadNotifications(); }}>
        <PopoverTrigger
          type="button"
          className="relative flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all duration-200 fx-pressable"
          title="Payment Reminders & Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-md animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[360px] sm:w-[440px] p-0 rounded-2xl border border-border/50 shadow-2xl bg-card overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black">
                  {unreadCount} UNREAD
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSound}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                title={soundEnabled ? "Disable Chime Sound" : "Enable Chime Sound"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-accent/30 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Web Push Permission Banner if not granted */}
          {pushPermission === "default" && (
            <div className="px-4 py-2.5 bg-accent/20 border-b border-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span>Receive browser push alerts</span>
              </div>
              <button
                type="button"
                onClick={requestPushPermission}
                className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-bold fx-pressable shadow-sm"
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

                const isExpanded = expandedId === item.notificationId;

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

                    {/* Contacted status indicator if logged */}
                    {item.isContacted && (
                      <div className="mb-2 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-semibold flex items-center justify-between">
                        <span>✓ Borrower Contacted</span>
                        {item.reminderNotes && <span className="truncate max-w-[160px] italic">"{item.reminderNotes}"</span>}
                      </div>
                    )}

                    {/* Quick Actions Row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/30">
                      <a
                        href={`tel:${item.borrowerMobile}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-[70px] h-7 px-2 flex items-center justify-center gap-1 rounded-lg bg-secondary hover:bg-accent/40 text-foreground text-[11px] font-semibold transition-colors"
                        title="Call Borrower"
                      >
                        <Phone className="h-3 w-3 text-primary" />
                        <span>Call</span>
                      </a>

                      <a
                        href={`https://wa.me/91${item.borrowerMobile.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          `Hi ${item.borrowerName}, payment reminder for your FINEXA loan. Amount Payable: Rs. ${(item.currentTotalPayable || item.outstandingBalance).toLocaleString("en-IN")}, Due Date: ${item.dueDate}. Thank you.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-[80px] h-7 px-2 flex items-center justify-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold transition-colors"
                        title="WhatsApp Reminder"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Message</span>
                      </a>

                      {item.reminderId && !item.isContacted && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkContacted(item.reminderId, item.borrowerName);
                          }}
                          className="h-7 px-2 flex items-center justify-center gap-1 rounded-lg bg-accent/25 hover:bg-accent/50 text-foreground text-[11px] font-semibold transition-colors"
                          title="Mark Borrower as Contacted"
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>Contacted</span>
                        </button>
                      )}

                      {item.reminderId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveReminderId(item.reminderId!);
                            setNoteText(item.reminderNotes || "");
                            setNoteModalOpen(true);
                          }}
                          className="h-7 px-2 flex items-center justify-center gap-1 rounded-lg bg-accent/25 hover:bg-accent/50 text-foreground text-[11px] font-semibold transition-colors"
                          title="Add Admin Note"
                        >
                          <FileText className="h-3 w-3 text-amber-500" />
                          <span>Note</span>
                        </button>
                      )}

                      <Link
                        href={`/loan-management`}
                        onClick={() => setIsOpen(false)}
                        className="h-7 px-2 flex items-center justify-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition-colors ml-auto"
                      >
                        <span>View Loan</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Admin Note Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl border border-border/50 p-6 bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Add Admin Follow-up Note</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Spoke to borrower. Agreed to arrange funds before the due date."
              className="w-full h-24 rounded-xl border border-border/50 bg-secondary/20 p-3 text-xs focus:ring-1 focus:ring-primary"
            />
          </div>
          <DialogFooter className="flex flex-row items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setNoteModalOpen(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-secondary hover:bg-accent/40 border border-border/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNote}
              className="px-4 py-1.5 text-xs font-bold fx-brand-gradient text-white rounded-xl fx-pressable shadow-sm"
            >
              Save Note
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
