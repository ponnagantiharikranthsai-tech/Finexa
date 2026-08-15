"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getLoansAction } from "../actions/get-loans.action";
import { recordPaymentAction } from "@/features/payments/actions/record-payment.action";
import { extendLoanAction } from "../actions/extend-loan.action";
import { payAndExtendAction } from "../actions/pay-and-extend.action";
import { generateLoanExtensionPdf } from "../utils/generate-loan-extension-pdf";
import { sendReminderAction } from "@/features/notifications/actions/send-reminder.action";
import { deleteLoanAction } from "../actions/delete-loan.action";
import { generateCurrentStatementPdf } from "../utils/generate-current-statement-pdf";
import { generatePaymentCompletedPdf } from "../utils/generate-payment-completed-pdf";
import { getExtraLoanDetailsAction } from "@/features/loans/actions/get-extra-loan-details.action";
import { calculatePeriods } from "@/domain/interest-calculator";
import { calculateAccruedPenalty } from "@/domain/penalty-calculator";
import { differenceInDays, format } from "date-fns";
import { Search, Plus, Send, Landmark, Calendar, RefreshCw, CreditCard, ChevronRight, Trash2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LoanWithBorrower } from "../repository/loan.repository";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";

interface LoansListProps {
  initialLoans: LoanWithBorrower[];
  total: number;
  totalPages: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: "bg-amber-500/10 text-amber-500 border border-amber-500/30 dark:text-amber-400 dark:border-amber-400/30",
    active:   "bg-secondary text-primary border border-border",
    overdue:  "bg-destructive/10 text-destructive border border-destructive/30",
    extended: "bg-secondary text-primary border border-border",
    closed:   "bg-muted/50 text-muted-foreground border border-border/50",
  };
  const label = status === "submitted" ? "Customer Details Submitted" : status;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${map[status] ?? ""}`}>
      {label}
    </span>
  );
}

function loanBorderClass(status: string) {
  if (status === "submitted") return "border-amber-500/30 dark:border-amber-400/30 bg-amber-500/[0.02]";
  if (status === "overdue")  return "fx-loan-overdue";
  if (status === "extended") return "fx-loan-extended";
  if (status === "closed")   return "fx-loan-closed";
  return "fx-loan-active";
}

// ─────────────────────────────────────────────────────────────────────────────

export function LoansList({ initialLoans, total, totalPages }: LoansListProps) {
  const router = useRouter();
  const [loans, setLoans] = useState<LoanWithBorrower[]>(initialLoans);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const [selectedLoan, setSelectedLoan] = useState<LoanWithBorrower | null>(null);
  const [paymentOpen, setPaymentOpen]   = useState(false);
  const [extendOpen, setExtendOpen]     = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType]     = useState<"interest" | "principal" | "penalty">("interest");
  const [paymentDate, setPaymentDate]     = useState(new Date().toISOString().split("T")[0]!);
  const [paymentNotes, setPaymentNotes]   = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("0");
  const [generatingStatementId, setGeneratingStatementId] = useState<string | null>(null);

  const handleCurrentStatement = async (loan: LoanWithBorrower) => {
    if (generatingStatementId === loan.loanId) return;
    setGeneratingStatementId(loan.loanId);
    toast.info("Generating Current Statement...");

    setTimeout(async () => {
      try {
        const res = await getExtraLoanDetailsAction(loan.loanId);
        const paymentsList = res.success && res.data?.payments ? res.data.payments : [];
        const cyclesList = res.success && res.data?.cycles ? res.data.cycles : [];

        const todayStr = new Date().toISOString().split("T")[0]!;
        const today = new Date(todayStr);
        const due = new Date(loan.dueDate);
        const isPaid = loan.outstandingBalance <= 0 || loan.status === "closed";
        const isOverdue = !isPaid && due < today;
        const overdueDays = isOverdue ? Math.max(0, differenceInDays(today, due)) : 0;
        const daysRemaining = !isOverdue && !isPaid ? Math.max(0, differenceInDays(due, today)) : 0;

        const accruedPenalty = calculateAccruedPenalty({
          principal: Number(loan.principal),
          dueDate: loan.dueDate,
          status: loan.status,
          penaltyRate: Number((loan as any).penaltyRate || 20),
          manualPenaltyAmount: Number(loan.penaltyAmount || 0),
        });

        const principal = Number(loan.principal);
        const interestRate = Number(loan.interestRate);
        const periods = calculatePeriods(loan.dateGiven, loan.dueDate);
        const monthlyInterestAmount = calculateMonthlyInterest(principal, interestRate);
        const totalInterest = periods * monthlyInterestAmount;

        const totalPayments = paymentsList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const totalPayable = loan.outstandingBalance;

        const nowFormatted = format(new Date(), "dd MMM yyyy, hh:mm a");
        const docId = `FIN-CST-${format(new Date(), "yyyyMMdd")}-${Math.floor(100000 + Math.random() * 900000)}`;

        generateCurrentStatementPdf({
          documentId: docId,
          statementDate: nowFormatted,
          loanId: loan.loanId,
          borrowerName: loan.borrower.name,
          mobile: loan.borrower.mobile,
          email: loan.borrower.email || undefined,
          principal,
          interestRate,
          interestType: loan.interestType as any,
          dateGiven: loan.dateGiven,
          dueDate: loan.dueDate,
          status: loan.status,
          penaltyRate: Number((loan as any).penaltyRate || 20),
          manualPenaltyAmount: Number(loan.penaltyAmount || 0),

          monthlyInterestAmount,
          totalInterest,
          accruedPenalty: accruedPenalty.totalPenalty,
          isPenaltyActive: accruedPenalty.isPenaltyActive,
          overdueDays,
          daysRemaining,
          isOverdue,

          totalPayments,
          outstandingBalance: loan.outstandingBalance,
          totalPayable,

          payments: paymentsList,
          cycles: cyclesList,
          notes: (loan as any).notes || undefined,
        });

        toast.success("Current Statement PDF generated & downloaded!");
      } catch (err: any) {
        console.error("Current Statement PDF Error:", err);
        toast.error("Unable to generate the current statement. Please try again.");
      } finally {
        setGeneratingStatementId(null);
      }
    }, 100);
  };

  // ── data refresh ────────────────────────────────────────────────────────────
  const refreshLoans = (currentSearch = search, currentStatus = status, currentPage = page) => {
    startTransition(async () => {
      const filters: any = {};
      if (currentSearch) filters.search = currentSearch;
      if (currentStatus !== "all") filters.status = currentStatus;
      const res = await getLoansAction(filters, currentPage, 20);
      if (res.success) setLoans(res.data.data);
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    refreshLoans(val, status, 1);
  };

  const handleStatusChange = (val: string | null) => {
    const s = val || "all";
    setStatus(s);
    setPage(1);
    refreshLoans(search, s, 1);
  };

  // ── actions ─────────────────────────────────────────────────────────────────
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    const fd = new FormData();
    fd.append("loanId", selectedLoan.loanId);
    fd.append("amount", paymentAmount);
    fd.append("paymentType", paymentType);
    fd.append("paymentDate", paymentDate);
    fd.append("notes", paymentNotes);
    startTransition(async () => {
      const res = await recordPaymentAction(null, fd);
      if (!res.success) {
        toast.error(typeof res.error === "string" ? res.error : "Failed to record payment");
        return;
      }

      const data = res.data;
      const paidAmt = Number(paymentAmount);

      try {
        await generatePaymentCompletedPdf(data);
        toast.success(`Payment of ₹${paidAmt.toLocaleString("en-IN")} recorded! Receipt downloaded.`, {
          action: {
            label: "📄 Download PDF",
            onClick: () => generatePaymentCompletedPdf(data),
          },
          duration: 8000,
        });
      } catch (pdfErr) {
        console.error("Payment PDF generation error:", pdfErr);
        toast.success(`Payment of ₹${paidAmt.toLocaleString("en-IN")} recorded!`);
      }

      setPaymentOpen(false);
      setPaymentAmount(""); setPaymentNotes("");
      refreshLoans(); router.refresh();
    });
  };

  const handleExtendConfirm = async () => {
    if (!selectedLoan) return;
    startTransition(async () => {
      const res = await payAndExtendAction(selectedLoan.loanId);
      if (!res.success) {
        const errText = typeof res.error === "string" ? res.error : "Failed to extend loan";
        toast.error(errText);
        return;
      }
      const data = res.data;
      try {
        await generateLoanExtensionPdf(data);
        toast.success(`Pay & Extend processed! Next cycle due: ${data.newDueDate}`, {
          action: {
            label: "📄 Download PDF",
            onClick: () => generateLoanExtensionPdf(data),
          },
          duration: 8000,
        });
      } catch (pdfErr) {
        console.error("PDF generation error:", pdfErr);
        toast.error("Loan extension completed, but the PDF could not be generated.", {
          action: {
            label: "🔄 Retry PDF",
            onClick: () => generateLoanExtensionPdf(data),
          },
          duration: 10000,
        });
      }
      setExtendOpen(false); refreshLoans(); router.refresh();
    });
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    startTransition(async () => {
      const res = await sendReminderAction(selectedLoan.loanId, Number(penaltyAmount || 0));
      if (res.success) {
        toast.success("Reminder sent via Email & SMS!");
        setReminderOpen(false); setPenaltyAmount("0");
        refreshLoans(); router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to send reminder");
      }
    });
  };

  const handleDeleteLoan = async (loanId: string, borrowerName: string) => {
    if (!confirm(`Are you sure you want to delete the loan for ${borrowerName}? This will permanently delete the loan and all associated repayments. This action cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await deleteLoanAction(loanId);
        if (res.success) {
          toast.success("Loan deleted successfully!");
          refreshLoans();
          router.refresh();
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Failed to delete loan.");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
        toast.error(errorMsg);
      }
    });
  };

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or mobile..."
            value={search}
            onChange={handleSearchChange}
            className="pl-9 h-10 rounded-xl bg-transparent border-border fx-input-glass"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-10 w-36 rounded-xl bg-transparent border-border">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="extended">Extended</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Link href="/loans/new">
            <Button className="h-10 rounded-xl gap-2 fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable">
              <Plus className="h-4 w-4" /> New
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div className="text-xs text-muted-foreground">
        {isPending ? (
          <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3 w-3 animate-spin" /> Refreshing...</span>
        ) : (
          <span>{total} loan{total !== 1 ? "s" : ""} total</span>
        )}
      </div>

      {/* ── Mobile Card List ────────────────────────────────────────────────── */}
      <div className="space-y-3 md:hidden">
        {loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center fx-glass-card rounded-2xl">
            <div className="h-14 w-14 bg-secondary rounded-2xl flex items-center justify-center mb-4">
              <CreditCard className="h-7 w-7 text-primary" />
            </div>
            <p className="font-bold text-foreground">No loans found</p>
            <p className="text-xs text-muted-foreground mt-1 mb-5">Try adjusting your search or filters.</p>
            <Link href="/loans/new">
              <Button size="sm" className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable">
                <Plus className="h-4 w-4 mr-1.5" /> Create First Loan
              </Button>
            </Link>
          </div>
        ) : (
          loans.map((loan) => (
            <div
              key={loan.loanId}
              className={`fx-glass-card rounded-2xl overflow-hidden fx-3d-hover ${loanBorderClass(loan.status)}`}
            >
              {/* Card top */}
              <div className="flex items-start justify-between p-4 pb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {loan.status === "overdue" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive fx-pulse-dot fx-neon-dot text-destructive shrink-0" />
                    )}
                    <h3 className="font-bold text-sm truncate text-foreground">{loan.borrower.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{loan.borrower.mobile}</p>
                </div>
                <StatusBadge status={loan.status} />
              </div>

              {/* Card data grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 bg-accent/20 border-y border-border/50">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Principal</p>
                  <p className="text-sm font-semibold">₹{Number(loan.principal).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Outstanding</p>
                  <p className="text-sm font-bold text-primary">₹{loan.outstandingBalance.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Rate</p>
                  <p className="text-sm font-semibold">₹{Number(loan.interestRate)}/{loan.interestType === "monthly" ? "mo" : "day"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Due Date</p>
                  <p className={`text-sm font-semibold ${loan.status === "overdue" ? "text-destructive" : ""}`}>{loan.dueDate}</p>
                </div>
              </div>

              {/* Card actions */}
              <div className="flex items-center gap-2 px-4 py-3">
                {loan.status !== "closed" && (
                  <>
                    <button
                      onClick={() => { setSelectedLoan(loan); setPaymentOpen(true); }}
                      className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl bg-secondary text-primary text-xs font-semibold hover:bg-accent transition-all duration-200 fx-pressable"
                    >
                      <Landmark className="h-3.5 w-3.5" /> Pay
                    </button>
                    <button
                      onClick={() => handleCurrentStatement(loan)}
                      disabled={generatingStatementId === loan.loanId}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-secondary text-primary text-xs font-semibold whitespace-nowrap hover:bg-accent transition-all duration-200 fx-pressable disabled:opacity-50"
                    >
                      {generatingStatementId === loan.loanId ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-3.5 w-3.5" />
                          <span>Loan Status</span>
                        </>
                      )}
                    </button>
                    {loan.status === "overdue" && (
                      <button
                        onClick={() => { setSelectedLoan(loan); setExtendOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl bg-accent/40 text-muted-foreground text-xs font-semibold hover:bg-accent/60 transition-all duration-200 fx-pressable"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Extend
                      </button>
                    )}
                  </>
                )}
                <Link href={`/loans/${loan.loanId}`} className="ml-auto">
                  <button className="flex items-center gap-1 h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all duration-200">
                    Details <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
                <button
                  onClick={() => handleDeleteLoan(loan.loanId, loan.borrower.name)}
                  disabled={isPending}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 flex items-center justify-center shrink-0"
                  title="Delete Loan"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop Table ────────────────────────────────────────────────────── */}
      <div className="hidden md:block rounded-2xl fx-glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/20 border-b border-border/50">
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Borrower</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Principal</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Rate</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Due Date</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Outstanding</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No loans match your filters.
                </TableCell>
              </TableRow>
            ) : (
              loans.map((loan) => (
                <TableRow key={loan.loanId} className={`fx-row-hover border-b border-border/30 ${loanBorderClass(loan.status)}`}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-sm">{loan.borrower.name}</p>
                      <p className="text-xs text-muted-foreground">{loan.borrower.mobile}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">₹{Number(loan.principal).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-muted-foreground">₹{Number(loan.interestRate)}/{loan.interestType === "monthly" ? "mo" : "d"}</TableCell>
                  <TableCell className={loan.status === "overdue" ? "text-destructive font-semibold" : ""}>
                    {loan.dueDate}
                  </TableCell>
                  <TableCell className="font-bold text-primary">
                    ₹{loan.outstandingBalance.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={loan.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {loan.status !== "closed" && (
                        <>
                          <button
                            onClick={() => { setSelectedLoan(loan); setPaymentOpen(true); }}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-secondary text-primary hover:bg-accent transition-all duration-200 fx-pressable"
                          >
                            <Landmark className="h-3.5 w-3.5" /> Pay
                          </button>
                          <button
                            onClick={() => { setSelectedLoan(loan); setReminderOpen(true); }}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-secondary text-primary hover:bg-accent transition-all duration-200 fx-pressable"
                          >
                            <Send className="h-3.5 w-3.5" /> Remind
                          </button>
                          {loan.status === "overdue" && (
                            <button
                              onClick={() => { setSelectedLoan(loan); setExtendOpen(true); }}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-accent/40 text-muted-foreground hover:bg-accent/60 transition-all duration-200 fx-pressable"
                            >
                              <Calendar className="h-3.5 w-3.5" /> Extend
                            </button>
                          )}
                        </>
                      )}
                      <Link href={`/loans/${loan.loanId}`}>
                        <button className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all duration-200">
                          View <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDeleteLoan(loan.loanId, loan.borrower.name)}
                        disabled={isPending}
                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                        title="Delete Loan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Record Payment Dialog ────────────────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Record Repayment</DialogTitle>
            <DialogDescription>
              Payment from <strong>{selectedLoan?.borrower.name}</strong>
            </DialogDescription>
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
                  <SelectItem value="penalty">Late Penalty Settlement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Date*</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required className="h-11 rounded-xl bg-transparent border-border fx-input-glass" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <Textarea placeholder="UPI ref or cash details..." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="rounded-xl bg-transparent border-border" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} className="rounded-xl border-border">Cancel</Button>
              <Button type="submit" disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable">Record Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Extend Period Dialog ─────────────────────────────────────────────── */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Extend Period?</DialogTitle>
            <DialogDescription>
              Extends {selectedLoan?.borrower.name}&apos;s loan by 1 month.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary border border-border rounded-xl p-4 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Current Due Date:</span> <strong>{selectedLoan?.dueDate}</strong></p>
            <p>
              <span className="text-muted-foreground">Interest for Extension:</span>{" "}
              <strong className="text-primary">
                ₹{selectedLoan && calculateMonthlyInterest(Number(selectedLoan.principal), Number(selectedLoan.interestRate)).toLocaleString("en-IN")}
              </strong>
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExtendOpen(false)} className="rounded-xl border-border">Cancel</Button>
            <Button onClick={handleExtendConfirm} disabled={isPending} className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable">Confirm Extension</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Reminder Dialog ─────────────────────────────────────────────── */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Send Reminder</DialogTitle>
            <DialogDescription>
              Send an automated reminder to <strong>{selectedLoan?.borrower.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReminderSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Late Penalty (₹, optional)</Label>
              <Input type="number" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} className="h-11 rounded-xl bg-transparent border-border fx-input-glass" />
              <p className="text-xs text-muted-foreground">This amount will be recorded as a penalty charge.</p>
            </div>
            <div className="bg-accent/30 rounded-xl p-4 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-2">Reminder delivered to:</p>
              <p>📧 {selectedLoan?.borrower.email}</p>
              <p>💬 {selectedLoan?.borrower.mobile}</p>
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
