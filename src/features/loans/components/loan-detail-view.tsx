"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, EyeOff, Send, Landmark, Calendar, Trash2, ArrowLeft, CheckCircle2, XCircle, Printer, Download, FileText } from "lucide-react";
import { deletePaymentAction } from "@/features/payments/actions/delete-payment.action";
import { recordPaymentAction } from "@/features/payments/actions/record-payment.action";
import { extendLoanAction } from "../actions/extend-loan.action";
import { payAndExtendAction } from "../actions/pay-and-extend.action";
import { sendReminderAction } from "@/features/notifications/actions/send-reminder.action";
import { getExtraLoanDetailsAction } from "@/features/loans/actions/get-extra-loan-details.action";
import { getReminderHistoryAction } from "@/features/notifications/actions/payment-reminders.action";
import { downloadPartialPaymentPdf, viewPartialPaymentPdf, printPartialPaymentPdf } from "../utils/generate-partial-payment-pdf";
import { downloadPaymentCompletedPdf, viewPaymentCompletedPdf, printPaymentCompletedPdf } from "../utils/generate-payment-completed-pdf";
import { useRouter } from "next/navigation";
import type { LoanDetailResult } from "../actions/get-loan-by-id.action";
import type { Payment, NotificationLog } from "@/db/schema";

interface LoanDetailViewProps {
  initialLoan: LoanDetailResult;
  initialPayments: Payment[];
  initialNotifs: NotificationLog[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:   "bg-secondary text-primary border border-border",
    overdue:  "bg-destructive/10 text-destructive border border-destructive/30",
    extended: "bg-secondary text-primary border border-border",
    closed:   "bg-muted/50 text-muted-foreground border border-border/50",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function LoanDetailView({ initialLoan, initialPayments, initialNotifs }: LoanDetailViewProps) {
  const router = useRouter();
  const [loan, setLoan] = useState<LoanDetailResult>(initialLoan);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [notifs, setNotifs] = useState<NotificationLog[]>(initialNotifs);
  const [reminderHistory, setReminderHistory] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadReminders() {
      const res = await getReminderHistoryAction(initialLoan.loanId);
      if (res.success && res.data) {
        setReminderHistory(res.data);
      }
    }
    loadReminders();
  }, [initialLoan.loanId]);

  const [showSensitive, setShowSensitive] = useState(false);
  const [paymentOpen, setPaymentOpen]     = useState(false);
  const [extendOpen, setExtendOpen]       = useState(false);
  const [reminderOpen, setReminderOpen]   = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType]     = useState<"interest" | "principal" | "penalty">("interest");
  const [paymentDate, setPaymentDate]     = useState(new Date().toISOString().split("T")[0]!);
  const [paymentNotes, setPaymentNotes]   = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("0");

  const maskPan = (pan: string) =>
    showSensitive ? pan : `•••••${pan.slice(-5)}`;
  const maskAadhaar = (aadhaar: string) =>
    showSensitive ? aadhaar : `••••••••${aadhaar.slice(-4)}`;

  // ── Helper to build PDF Payload for any historical payment record ──────
  const buildPayloadForPayment = (pIdx: number) => {
    const p = payments[pIdx];
    const principalNum = Number(loan.principal || 0);
    const rateNum = Number(loan.interestRate || 0);
    const monthlyInterestAmount = loan.monthlyInterestAmount || Math.round((principalNum * rateNum) / 1000);
    const penaltyNum = Number(loan.penaltyAmount || 0);
    const totalPayable = principalNum + monthlyInterestAmount + penaltyNum;

    const historyUpToCurrent = payments.slice(0, pIdx + 1);
    const previousPaidAmount = payments.slice(0, pIdx).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const currentPaymentAmount = Number(p.amount || 0);
    const totalAmountPaidToDate = previousPaidAmount + currentPaymentAmount;
    const remainingBalance = Math.max(0, totalPayable - totalAmountPaidToDate);
    const isFullyCleared = remainingBalance <= 0;
    const paymentStatus: "PARTIAL PAYMENT" | "PAID / COMPLETED" = isFullyCleared ? "PAID / COMPLETED" : "PARTIAL PAYMENT";

    const dateFormatted = (p.paymentDate || "").replace(/-/g, "");
    const currentReceiptNo = `RC-${dateFormatted}-${String(pIdx + 1).padStart(3, "0")}`;

    let accumPaid = 0;
    const paymentsHistory = historyUpToCurrent.map((item, idx) => {
      const itemAmt = Number(item.amount || 0);
      accumPaid += itemAmt;
      const itemBal = Math.max(0, totalPayable - accumPaid);
      return {
        paymentId: item.paymentId,
        paymentDate: item.paymentDate,
        date: item.paymentDate,
        receiptNo: `RC-${(item.paymentDate || "").replace(/-/g, "")}-${String(idx + 1).padStart(3, "0")}`,
        amount: itemAmt,
        amountPaid: itemAmt,
        totalPaid: accumPaid,
        balance: itemBal,
        paymentType: item.paymentType,
        notes: item.notes,
      };
    });

    return {
      documentId: `FIN-PAY-${dateFormatted}-${pIdx + 1001}`,
      receiptNumber: currentReceiptNo,
      transactionId: p.paymentId,
      paymentDate: p.paymentDate,
      paymentAmount: currentPaymentAmount,
      paymentType: p.paymentType,
      notes: p.notes,

      loanId: loan.loanId,
      borrowerName: loan.borrower.name,
      borrowerMobile: loan.borrower.mobile,
      email: loan.borrower.email || undefined,
      locationUrl: loan.borrower.locationUrl || undefined,

      dateGiven: loan.dateGiven,
      dueDate: loan.dueDate,
      principal: principalNum,
      interestRate: rateNum,
      interestType: loan.interestType || "monthly",
      monthlyInterestAmount,
      loanType: loan.interestType || "Monthly",

      principalPaid: p.paymentType === "principal" ? currentPaymentAmount : 0,
      interestPaid: p.paymentType === "interest" ? currentPaymentAmount : 0,
      penaltyPaid: p.paymentType === "penalty" ? currentPaymentAmount : 0,

      previousOutstanding: Math.max(0, totalPayable - previousPaidAmount),
      remainingOutstanding: remainingBalance,
      totalPayableAfterPayment: remainingBalance,
      totalAmountPaidToDate,
      totalInterestAccrued: monthlyInterestAmount,
      totalPenaltyAccrued: penaltyNum,

      totalPayable,
      previousPaidAmount,
      currentPaymentAmount,
      remainingBalance,
      paymentStatus,

      loanStatus: isFullyCleared ? "CLOSED" : loan.status.toUpperCase(),
      isFullyCleared,

      paymentsHistory,
    };
  };

  // ── actions ──────────────────────────────────────────────────────────────
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("loanId", loan.loanId);
    fd.append("amount", paymentAmount);
    fd.append("paymentType", paymentType);
    fd.append("paymentDate", paymentDate);
    fd.append("notes", paymentNotes);
    startTransition(async () => {
      const res = await recordPaymentAction(null, fd);
      if (res.success && res.data) {
        const payload = res.data;
        setPaymentOpen(false);
        setPaymentAmount("");
        setPaymentNotes("");

        if (payload.isFullyCleared) {
          downloadPaymentCompletedPdf(payload as any);
          toast.success("FULL PAYMENT COMPLETED! PDF receipt generated.", {
            action: {
              label: "📄 View PDF",
              onClick: () => viewPaymentCompletedPdf(payload as any),
            },
            duration: 8000,
          });
        } else {
          downloadPartialPaymentPdf(payload as any);
          toast.success(`PARTIAL PAYMENT RECORDED! Remaining: ₹${Number(payload.remainingBalance || 0).toLocaleString("en-IN")}`, {
            action: {
              label: "📄 View Receipt",
              onClick: () => viewPartialPaymentPdf(payload as any),
            },
            duration: 8000,
          });
        }
        router.refresh();
      } else {
        const errText = (res as any)?.error;
        toast.error(typeof errText === "string" ? errText : "Failed to record payment");
      }
    });
  };

  const handleExtendConfirm = async () => {
    startTransition(async () => {
      const res = await payAndExtendAction(loan.loanId);
      if (!res.success) {
        const errText = typeof res.error === "string" ? res.error : "Failed to extend loan";
        toast.error(errText);
        return;
      }
      const data = res.data;
      try {
        const { generateLoanExtensionPdf } = await import("../utils/generate-loan-extension-pdf");
        generateLoanExtensionPdf(data);
        toast.success(`Pay & Extend processed! Next cycle due: ${data.newDueDate}`, {
          action: {
            label: "📄 Download PDF",
            onClick: async () => {
              const { generateLoanExtensionPdf: genPdf } = await import("../utils/generate-loan-extension-pdf");
              genPdf(data);
            },
          },
          duration: 8000,
        });
      } catch (pdfErr) {
        console.error("PDF generation error:", pdfErr);
        toast.error("Loan extension completed, but the PDF could not be generated.", {
          action: {
            label: "🔄 Retry PDF",
            onClick: async () => {
              const { generateLoanExtensionPdf: genPdf } = await import("../utils/generate-loan-extension-pdf");
              genPdf(data);
            },
          },
          duration: 10000,
        });
      }
      setExtendOpen(false);
      router.refresh();
    });
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await sendReminderAction(loan.loanId, Number(penaltyAmount || 0));
      if (res.success) {
        toast.success("Reminder sent!"); setReminderOpen(false); setPenaltyAmount("0"); router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to send reminder");
      }
    });
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Delete this payment record? This will restore the outstanding balance.")) return;
    startTransition(async () => {
      const res = await deletePaymentAction(paymentId, loan.loanId);
      if (res.success) {
        toast.success("Payment deleted."); router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to delete payment");
      }
    });
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Back nav */}
      <Link href="/loans">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Loans
        </button>
      </Link>

      {/* Outstanding Hero Banner */}
      <div className={`rounded-2xl p-5 flex items-center justify-between relative overflow-hidden ${
        loan.status === "overdue"
          ? "bg-gradient-to-r from-destructive to-destructive/80 text-white"
          : loan.status === "extended"
          ? "bg-gradient-to-r from-primary to-primary/80 text-white"
          : loan.status === "closed"
          ? "bg-gradient-to-r from-muted-foreground to-muted-foreground/80 text-white"
          : "fx-brand-gradient text-white"
      } fx-shadow-glow`}>
        {/* Decorative orb */}
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Outstanding Balance</p>
          <p className="text-3xl font-extrabold tracking-tight">₹{loan.outstandingBalance.toLocaleString("en-IN")}</p>
          <p className="text-white/70 text-xs mt-1">{loan.borrower.name} · Due {loan.dueDate}</p>
        </div>
        <StatusBadge status={loan.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">

        {/* ── Left: Borrower + Payments ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Borrower Card */}
          <div className="fx-glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div>
                <h2 className="font-extrabold text-base">{loan.borrower.name}</h2>
                <p className="text-xs text-muted-foreground">Borrower Profile</p>
              </div>
              <button
                onClick={() => setShowSensitive(!showSensitive)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all duration-200 px-3 py-1.5 rounded-xl hover:bg-accent/30"
              >
                {showSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showSensitive ? "Hide" : "Reveal"} ID
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-sm">
              {[
                { label: "Mobile", value: loan.borrower.mobile },
                { label: "Email", value: loan.borrower.email },
                { label: "PAN Card", value: maskPan(loan.borrower.panDecrypted) },
                { label: "Aadhaar", value: maskAadhaar(loan.borrower.aadhaarDecrypted) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">{label}</p>
                  <p className="font-semibold text-sm">{value}</p>
                </div>
              ))}
              {loan.borrower.locationUrl && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Location</p>
                  <a
                    href={loan.borrower.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 hover:underline font-medium text-sm break-all transition-colors"
                  >
                    Open in Maps ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="fx-glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div>
                <h2 className="font-bold text-sm">Payment History</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{payments.length} record{payments.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="p-4">
              {payments.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p, pIdx) => {
                    const payload = buildPayloadForPayment(pIdx);
                    const isCompleted = payload.isFullyCleared;

                    const handleView = () => {
                      if (isCompleted) {
                        viewPaymentCompletedPdf(payload as any);
                      } else {
                        viewPartialPaymentPdf(payload as any);
                      }
                    };

                    const handleDownload = () => {
                      if (isCompleted) {
                        downloadPaymentCompletedPdf(payload as any);
                      } else {
                        downloadPartialPaymentPdf(payload as any);
                      }
                    };

                    const handlePrint = () => {
                      if (isCompleted) {
                        printPaymentCompletedPdf(payload as any);
                      } else {
                        printPartialPaymentPdf(payload as any);
                      }
                    };

                    return (
                      <div key={p.paymentId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-accent/20 border border-border/30 fx-row-hover">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {payload.receiptNumber}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              p.paymentType === "interest" ? "bg-secondary text-primary" :
                              p.paymentType === "principal" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                              "bg-destructive/10 text-destructive"
                            }`}>
                              {p.paymentType}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isCompleted ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            }`}>
                              {isCompleted ? "FULL PAYMENT" : "PARTIAL"}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto sm:ml-0">{p.paymentDate}</span>
                          </div>
                          {p.notes && <p className="text-xs text-muted-foreground truncate">{p.notes}</p>}
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 ml-0 sm:ml-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                          <span className="font-extrabold text-sm text-primary">
                            +₹{Number(p.amount).toLocaleString("en-IN")}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handleView}
                              title="View PDF Receipt"
                              className="text-primary/70 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10 flex items-center gap-1 text-xs font-semibold"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">View</span>
                            </button>
                            <button
                              onClick={handleDownload}
                              title="Download PDF Receipt"
                              className="text-primary/70 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10 flex items-center gap-1 text-xs font-semibold"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">Download</span>
                            </button>
                            <button
                              onClick={handlePrint}
                              title="Print PDF Receipt"
                              className="text-primary/70 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10 flex items-center gap-1 text-xs font-semibold"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">Print</span>
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.paymentId)}
                              title="Delete Payment Record"
                              className="text-destructive/60 hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Loan Details + Actions + Notifications ────────────────── */}
        <div className="space-y-5">

          {/* Loan Info */}
          <div className="fx-glass-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50">
              <h2 className="font-bold text-sm">Loan Details</h2>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {[
                { label: "Principal",        value: `₹${Number(loan.principal).toLocaleString("en-IN")}` },
                { label: "Rate",             value: `₹${Number(loan.interestRate)}/${loan.interestType === "monthly" ? "month" : "day"}` },
                { label: "Monthly Interest", value: `₹${loan.monthlyInterestAmount.toLocaleString("en-IN")}` },
                { label: "Penalty Applied",  value: `₹${Number(loan.penaltyAmount || 0).toLocaleString("en-IN")}`, red: Number(loan.penaltyAmount || 0) > 0 },
                { label: "Issued",           value: loan.dateGiven },
                { label: "Due Date",         value: loan.dueDate, red: loan.status === "overdue" },
              ].map(({ label, value, red }) => (
                <div key={label} className="flex justify-between items-center border-b border-border/30 pb-3 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${red ? "text-destructive" : ""}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            {loan.status !== "closed" && (
              <div className="px-5 pb-5 space-y-2">
                <button
                  onClick={() => setPaymentOpen(true)}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl fx-brand-gradient text-white text-sm font-semibold fx-cta-glow fx-pressable"
                >
                  <Landmark className="h-4 w-4" /> Record Repayment
                </button>
                <button
                  onClick={() => setReminderOpen(true)}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-border/50 text-sm font-semibold hover:bg-accent/30 transition-all duration-200 fx-pressable"
                >
                  <Send className="h-4 w-4" /> Send Reminder
                </button>
                {loan.status === "overdue" && (
                  <button
                    onClick={() => setExtendOpen(true)}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-secondary border border-border text-primary text-sm font-semibold hover:bg-accent transition-all duration-200 fx-pressable"
                  >
                    <Calendar className="h-4 w-4" /> Extend Period
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notifications Log */}
          <div className="fx-glass-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50">
              <h2 className="font-bold text-sm">Notifications Log</h2>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No notifications sent yet.</p>
              ) : (
                <div className="space-y-2">
                  {notifs.map((n) => (
                    <div key={n.notificationId} className="flex items-start justify-between p-3 rounded-xl bg-accent/20 border border-border/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold capitalize">{n.type} via {n.channel}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.sentAt).toLocaleString()}</p>
                        {n.errorMessage && <p className="text-[10px] text-destructive mt-0.5">{n.errorMessage}</p>}
                      </div>
                      <div className="ml-2 shrink-0">
                        {n.status === "sent" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reminder History & Schedule */}
          <div className="fx-glass-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <h2 className="font-bold text-sm">Payment Reminder History</h2>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Asia/Kolkata</span>
            </div>
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {reminderHistory.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No reminder schedule generated yet.</p>
              ) : (
                reminderHistory.map((rem) => {
                  let badgeStyle = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                  let iconSymbol = "○";
                  if (rem.status === "sent") {
                    badgeStyle = "bg-blue-500/10 text-blue-500 border-blue-500/20";
                    iconSymbol = "✓";
                  } else if (rem.status === "contacted") {
                    badgeStyle = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                    iconSymbol = "✓";
                  } else if (rem.status === "cancelled") {
                    badgeStyle = "bg-muted/40 text-muted-foreground border-border/40";
                    iconSymbol = "✕";
                  }

                  const labelMap: Record<string, string> = {
                    "10d": "10 Days Before",
                    "7d": "7 Days Before",
                    "3d": "3 Days Before",
                    "1d": "1 Day Before",
                    due_date: "Due Date",
                    overdue: "Overdue Follow-up",
                  };

                  return (
                    <div key={rem.reminderId} className="flex items-start gap-2.5 p-3 rounded-xl bg-accent/15 border border-border/30">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-extrabold shrink-0">
                        {iconSymbol}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-foreground">
                            {labelMap[rem.intervalKey] || rem.intervalKey}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${badgeStyle}`}>
                            {rem.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Scheduled Date: <strong>{rem.scheduledDate}</strong></p>
                        {rem.notes && (
                          <p className="text-[11px] text-foreground italic mt-1 bg-background/60 p-2 rounded-lg border border-border/40">
                            "{rem.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-extrabold">Record Repayment</DialogTitle>
            <DialogDescription>Payment from <strong>{loan.borrower.name}</strong></DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)*</Label>
              <Input type="number" placeholder="1000" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required className="h-11 rounded-xl bg-transparent border-border fx-input-glass" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allocation*</Label>
              <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                <SelectTrigger className="h-11 rounded-xl bg-transparent border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">Interest Repayment</SelectItem>
                  <SelectItem value="principal">Principal Reduction</SelectItem>
                  <SelectItem value="penalty">Penalty Settlement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date*</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required className="h-11 rounded-xl bg-transparent border-border fx-input-glass" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <Textarea placeholder="UPI ref, cash receipt..." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="rounded-xl bg-transparent border-border" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} className="rounded-xl border-border">Cancel</Button>
              <Button type="submit" disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable">Record Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Extend Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-extrabold">Extend Loan Period?</DialogTitle>
            <DialogDescription>Extends due date by 1 month.</DialogDescription>
          </DialogHeader>
          <div className="bg-secondary border border-border rounded-xl p-4 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Current Due Date:</span> <strong>{loan.dueDate}</strong></p>
            <p><span className="text-muted-foreground">Extension Interest:</span> <strong className="text-primary">₹{loan.monthlyInterestAmount.toLocaleString("en-IN")}</strong></p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExtendOpen(false)} className="rounded-xl border-border">Cancel</Button>
            <Button onClick={handleExtendConfirm} disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable">Confirm Extension</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reminder Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-extrabold">Send Reminder</DialogTitle>
            <DialogDescription>Notify <strong>{loan.borrower.name}</strong> via Email & SMS.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReminderSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Late Penalty (₹, optional)</Label>
              <Input type="number" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} className="h-11 rounded-xl bg-transparent border-border fx-input-glass" />
            </div>
            <div className="bg-accent/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">Delivery channels:</p>
              <p>📧 {loan.borrower.email}</p>
              <p>💬 {loan.borrower.mobile}</p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setReminderOpen(false)} className="rounded-xl border-border">Cancel</Button>
              <Button type="submit" disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white gap-2 fx-cta-glow fx-pressable">
                <Send className="h-4 w-4" /> Send Now
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
