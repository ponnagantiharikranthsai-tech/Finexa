import { getBorrowersAction } from "@/features/borrowers/actions/get-borrowers.action";
import { Users, ChevronRight, AlertTriangle, Clock, Check, Calendar, IndianRupee } from "lucide-react";
import Link from "next/link";
import { db } from "@/db/client";
import { loansTable, paymentsTable } from "@/db/schema";
import { inArray, eq, sql } from "drizzle-orm";
import { calculatePeriods, calculateMonthlyInterest, calculateOutstandingBalance } from "@/domain/interest-calculator";
import { DeleteBorrowerButton } from "@/features/borrowers/components/delete-borrower-button";

export const revalidate = 0;

// Safe date parser to avoid timezone shifts
const parseDbDate = (str: string | Date) => {
  if (str instanceof Date) return str;
  const [year, month, day] = str.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
};

export default async function BorrowersPage() {
  const res = await getBorrowersAction();
  const borrowers = res.success ? res.data.data : [];

  const borrowerIds = borrowers.map((b) => b.borrowerId);
  
  // Batched fetch of all loans for the borrowers on this page
  const loans = borrowerIds.length > 0
    ? await db.select().from(loansTable).where(inArray(loansTable.borrowerId, borrowerIds))
    : [];

  const loanIds = loans.map((l) => l.loanId);
  
  // Batched fetch of all payments for the active/inactive loans
  const payments = loanIds.length > 0
    ? await db.select().from(paymentsTable).where(inArray(paymentsTable.loanId, loanIds))
    : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Compute stats and status for each borrower
  const borrowersWithStats = borrowers.map((b) => {
    const borrowerLoans = loans.filter((l) => l.borrowerId === b.borrowerId);
    const pendingLoans = [];

    for (const loan of borrowerLoans) {
      const loanPayments = payments.filter((p) => p.loanId === loan.loanId);
      const totalPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const periods = calculatePeriods(loan.dateGiven, loan.dueDate);
      const monthlyInterest = calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate));
      const totalInterest = periods * monthlyInterest;
      const penalty = Number(loan.penaltyAmount || 0);
      
      const outstanding = calculateOutstandingBalance(
        Number(loan.principal),
        totalInterest,
        penalty,
        totalPaid
      );

      if (outstanding > 0 && loan.status !== "closed") {
        pendingLoans.push({ loan, outstanding });
      }
    }

    let activeLoan = null;
    let loanAmount = 0;
    let outstandingAmount = 0;
    let dueDate = null;
    let daysRemaining = 0;
    let daysOverdue = 0;
    let status: "active" | "due_today" | "overdue" | "paid" = "paid";

    if (pendingLoans.length > 0) {
      // Prioritize overdue, then due today, then active loans
      const sortedPending = pendingLoans.map(({ loan, outstanding }) => {
        const due = parseDbDate(loan.dueDate);
        due.setHours(0, 0, 0, 0);
        
        let loanStatus: "active" | "due_today" | "overdue" = "active";
        let overdueDays = 0;
        let remainingDays = 0;

        const timeDiff = due.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysDiff < 0) {
          loanStatus = "overdue";
          overdueDays = Math.abs(daysDiff);
        } else if (daysDiff === 0) {
          loanStatus = "due_today";
        } else {
          loanStatus = "active";
          remainingDays = daysDiff;
        }

        return { loan, outstanding, status: loanStatus, overdueDays, remainingDays };
      });

      const urgent = sortedPending.find((l) => l.status === "overdue") ||
                     sortedPending.find((l) => l.status === "due_today") ||
                     sortedPending[0]!;

      activeLoan = urgent.loan;
      loanAmount = Number(urgent.loan.principal);
      outstandingAmount = urgent.outstanding;
      dueDate = urgent.loan.dueDate;
      daysRemaining = urgent.remainingDays;
      daysOverdue = urgent.overdueDays;
      status = urgent.status;
    } else if (borrowerLoans.length > 0) {
      // All loans are paid / closed. Show the most recent one.
      const sortedLoans = [...borrowerLoans].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const mostRecent = sortedLoans[0]!;
      
      activeLoan = mostRecent;
      loanAmount = Number(mostRecent.principal);
      outstandingAmount = 0;
      dueDate = mostRecent.dueDate;
      status = "paid";
    }

    return {
      ...b,
      status,
      loanAmount,
      outstandingAmount,
      dueDate,
      daysRemaining,
      daysOverdue,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Borrowers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identity records, KYC, and loan history for all borrowers.
          </p>
        </div>
      </div>

      {borrowersWithStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center fx-glass-card rounded-2xl">
          <div className="h-14 w-14 bg-secondary rounded-2xl flex items-center justify-center mb-4">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <p className="font-bold text-foreground">No borrowers yet</p>
          <p className="text-xs text-muted-foreground mt-1">Borrowers are auto-registered when you create a loan.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {borrowersWithStats.map((b) => {
            // Status-specific configuration
            const config = {
              active: {
                cardBg: "bg-amber-500/[0.02] hover:bg-amber-500/[0.04] border-amber-500/15 shadow-[0_0_15px_-3px_rgba(217,119,6,0.15)] hover:shadow-[0_0_22px_0_rgba(217,119,6,0.22)]",
                badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                label: "Active",
                icon: <Clock className="h-3 w-3" />,
                detailsColor: "text-amber-400/80"
              },
              due_today: {
                cardBg: "bg-blue-500/[0.03] hover:bg-blue-500/[0.05] border-blue-500/25 shadow-[0_0_15px_-3px_rgba(59,130,246,0.25)] hover:shadow-[0_0_25px_0_rgba(59,130,246,0.35)] animate-[pulse_4s_infinite_ease-in-out]",
                badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                label: "Due Today",
                icon: <Clock className="h-3 w-3" />,
                detailsColor: "text-blue-400/80"
              },
              overdue: {
                cardBg: "bg-red-500/[0.03] hover:bg-red-500/[0.05] border-red-500/25 shadow-[0_0_15px_-3px_rgba(239,68,68,0.25)] hover:shadow-[0_0_25px_0_rgba(239,68,68,0.35)]",
                badge: "bg-red-500/10 text-red-400 border border-red-500/20",
                label: "Overdue",
                icon: <AlertTriangle className="h-3 w-3" />,
                detailsColor: "text-red-400/80"
              },
              paid: {
                cardBg: "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] border-emerald-500/15 shadow-[0_0_12px_-3px_rgba(16,185,129,0.12)] hover:shadow-[0_0_20px_0_rgba(16,185,129,0.2)]",
                badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                label: "Paid",
                icon: <Check className="h-3 w-3" />,
                detailsColor: "text-emerald-400/80"
              }
            }[b.status];

            return (
              <Link key={b.borrowerId} href={`/borrowers/${b.borrowerId}`} className="block">
                <div className={`flex flex-col justify-between h-full fx-glass-card rounded-[22px] p-5 border transition-all duration-300 ease-out fx-3d-hover ${config.cardBg}`}>
                  {/* Top Row: Info + Status */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl fx-brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0 fx-shadow-glow-sm">
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-sm text-foreground tracking-tight">{b.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.mobile}</p>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
                        {config.icon}
                        {config.label}
                      </span>
                    </div>

                    {/* Loan Details Grid */}
                    {b.dueDate && (
                      <div className="grid grid-cols-2 gap-3.5 bg-black/20 p-3.5 rounded-xl border border-white/[0.02] text-left text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Loan Amount</p>
                          <p className="font-extrabold text-foreground mt-0.5">₹{b.loanAmount.toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Outstanding</p>
                          <p className={`font-extrabold mt-0.5 ${b.outstandingAmount > 0 ? "text-foreground" : "text-emerald-400"}`}>
                            ₹{b.outstandingAmount.toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Due Date</p>
                          <p className="font-semibold text-foreground mt-0.5">
                            {new Date(b.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Timeline</p>
                          <p className={`font-semibold mt-0.5 ${config.detailsColor}`}>
                            {b.status === "overdue" && `${b.daysOverdue} Days Overdue`}
                            {b.status === "due_today" && "Due Today"}
                            {b.status === "active" && `${b.daysRemaining} Days Left`}
                            {b.status === "paid" && "Settled"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Call to Action */}
                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/[0.03]">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">View Ledger</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <DeleteBorrowerButton borrowerId={b.borrowerId} borrowerName={b.name} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
