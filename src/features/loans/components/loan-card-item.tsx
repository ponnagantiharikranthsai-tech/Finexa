"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard, Landmark, RefreshCw, AlertTriangle, Check, Clock,
  ArrowLeftRight, ExternalLink, Plus, FileText, Edit, Trash2
} from "lucide-react";
import { calculateAccruedPenalty } from "@/domain/penalty-calculator";
import { differenceInDays } from "date-fns";
import type { LoanManagementDetailResult } from "../actions/get-loan-management-data.action";

export interface LoanCardItemProps {
  loan: LoanManagementDetailResult;
  onPay: (loan: LoanManagementDetailResult) => void;
  onViewDetails: (loan: LoanManagementDetailResult) => void;
  onEditOpen: (loan: LoanManagementDetailResult, e: React.MouseEvent) => void;
  onDeleteLoan: (loanId: string, borrowerName: string, e: React.MouseEvent) => void;
  onCurrentStatement: (loan: LoanManagementDetailResult) => void;
  onOpenReassign: (
    loan: LoanManagementDetailResult,
    allocationId: string,
    amount: number,
    funderName: string,
    e: React.MouseEvent
  ) => void;
  onAllocateCapital: (loan: LoanManagementDetailResult) => void;
  generatingStatementId: string | null;
  isPending: boolean;
}

function getCardStatus(status: string, outstanding: number, dueDate: string) {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const today = new Date(todayStr);

  const isPaid = outstanding <= 0 || status === "closed";
  const isDueToday = dueDate === todayStr;
  const isOverdue = status === "overdue" || (new Date(dueDate) < today && !isPaid);

  if (isPaid) return "paid";
  if (isDueToday) return "due_today";
  if (isOverdue) return "overdue";
  return "active";
}

function StatusBadge({ status, outstanding, dueDate }: { status: string; outstanding: number; dueDate: string }) {
  const dynamicStatus = getCardStatus(status, outstanding, dueDate);

  const config = {
    active: {
      badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      label: "Active",
      icon: <Clock className="h-3 w-3" />,
    },
    due_today: {
      badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      label: "Due Today",
      icon: <Clock className="h-3 w-3 animate-[pulse_1.5s_infinite]" />,
    },
    overdue: {
      badge: "bg-red-500/10 text-red-400 border border-red-500/20",
      label: "Overdue",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    paid: {
      badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      label: "Paid",
      icon: <Check className="h-3 w-3" />,
    },
  }[dynamicStatus];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function getCardGlow(status: string) {
  if (status === "overdue") {
    return "bg-red-500/[0.03] hover:bg-red-500/[0.05] border-red-500/25 shadow-[0_0_15px_-3px_rgba(239,68,68,0.25)] hover:shadow-[0_0_25px_0_rgba(239,68,68,0.35)]";
  }
  if (status === "due_today") {
    return "bg-blue-500/[0.03] hover:bg-blue-500/[0.05] border-blue-500/25 shadow-[0_0_15px_-3px_rgba(59,130,246,0.25)] hover:shadow-[0_0_25px_0_rgba(59,130,246,0.35)] animate-[pulse_4s_infinite_ease-in-out]";
  }
  if (status === "paid") {
    return "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] border-emerald-500/15 shadow-[0_0_12px_-3px_rgba(16,185,129,0.12)] hover:shadow-[0_0_20px_0_rgba(16,185,129,0.2)]";
  }
  return "bg-amber-500/[0.02] hover:bg-amber-500/[0.04] border-amber-500/20 shadow-[0_0_15px_-3px_rgba(212,175,55,0.15)] hover:shadow-[0_0_22px_0_rgba(212,175,55,0.22)]";
}

function getAvatarInitials(name: string) {
  if (!name) return "B";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const LoanCardItem = React.memo(function LoanCardItem({
  loan,
  onPay,
  onViewDetails,
  onEditOpen,
  onDeleteLoan,
  onCurrentStatement,
  onOpenReassign,
  onAllocateCapital,
  generatingStatementId,
  isPending,
}: LoanCardItemProps) {
  const router = useRouter();
  const todayStr = new Date().toISOString().split("T")[0]!;
  const today = new Date(todayStr);

  const dynamicStatus = getCardStatus(loan.status, loan.outstandingBalance, loan.dueDate);
  const cardBg = getCardGlow(dynamicStatus);
  const isSettled = loan.outstandingBalance <= 0 || loan.status === "closed";

  const accruedPenalty = calculateAccruedPenalty({
    principal: Number(loan.principal),
    dueDate: loan.dueDate,
    status: loan.status,
    penaltyRate: Number((loan as any).penaltyRate || 20),
    manualPenaltyAmount: Number(loan.penaltyAmount || 0),
  });

  return (
    <div
      className={`flex flex-col justify-between h-full fx-glass-card rounded-[22px] p-5 border transition-all duration-300 ease-out fx-3d-hover ${cardBg}`}
    >
      {/* Profile + Status Row */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl fx-brand-gradient flex items-center justify-center text-white font-black text-sm shrink-0 fx-shadow-glow-sm">
              {getAvatarInitials(loan.borrower.name)}
            </div>
            <div className="text-left min-w-0">
              <p className="font-semibold text-sm text-foreground tracking-tight truncate max-w-[130px]">{loan.borrower.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{loan.borrower.mobile}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={loan.status} outstanding={loan.outstandingBalance} dueDate={loan.dueDate} />
            {(loan as any).isOptimistic && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 animate-pulse">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                SYNCING
              </span>
            )}
            {accruedPenalty.isPenaltyActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="h-3 w-3" />
                PENALTY ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Loan Details Grid */}
        <div className="grid grid-cols-2 gap-3 bg-black/15 dark:bg-black/35 p-3.5 rounded-xl border border-white/[0.02] text-left text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Loan Amount</p>
            <p className="font-extrabold text-foreground mt-0.5">₹{Number(loan.principal).toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Outstanding Amount</p>
            <p className={`font-extrabold mt-0.5 ${loan.outstandingBalance > 0 ? "text-primary" : "text-emerald-400"}`}>
              ₹{loan.outstandingBalance.toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Penalty</p>
            <p className={`font-extrabold mt-0.5 ${accruedPenalty.totalPenalty > 0 ? "text-red-400 font-bold" : "text-emerald-400"}`}>
              ₹{accruedPenalty.totalPenalty.toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Due Date</p>
            <p className="font-semibold text-foreground mt-0.5">
              {new Date(loan.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Timeline</p>
            <p className={`font-semibold mt-0.5 ${
              dynamicStatus === "overdue" ? "text-red-400 font-bold" :
              dynamicStatus === "due_today" ? "text-blue-400 font-bold" :
              dynamicStatus === "paid" ? "text-emerald-400" :
              "text-amber-400"
            }`}>
              {dynamicStatus === "overdue" && `${differenceInDays(today, new Date(loan.dueDate))} Days Overdue`}
              {dynamicStatus === "due_today" && "Due Today"}
              {dynamicStatus === "active" && `${differenceInDays(new Date(loan.dueDate), today)} Days Left`}
              {dynamicStatus === "paid" && "Settled"}
            </p>
          </div>
          <div className="col-span-2 border-t border-white/[0.04] pt-2 mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>Rate: ₹{Number(loan.interestRate)}/{loan.interestType === "monthly" ? "mo" : "day"}</span>
            <span>Payment Status: <strong className="capitalize">{
              dynamicStatus === "paid" ? "Paid" :
              dynamicStatus === "due_today" ? "Payment Pending" :
              dynamicStatus === "overdue" ? "Overdue" :
              "Active"
            }</strong></span>
          </div>
        </div>

        {/* Capital / Funding Source Section */}
        <div className="p-3 rounded-xl bg-black/15 dark:bg-black/35 border border-white/[0.04] text-xs space-y-2 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Landmark className="h-3 w-3 text-primary" /> Capital Source
            </span>
            {loan.funding && loan.funding.isFullyFunded ? (
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Fully Funded
              </span>
            ) : loan.funding && loan.funding.isPartiallyFunded ? (
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Partially Funded
              </span>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40">
                Not Assigned
              </span>
            )}
          </div>

          {loan.funding && loan.funding.sources.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {loan.funding.sources.map((s) => (
                  <div
                    key={s.allocationId}
                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 hover:border-primary/50 hover:bg-primary/20 text-[11px] font-semibold text-foreground transition-all duration-200 cursor-pointer"
                    title="Click to reassign capital source"
                    onClick={(e) => onOpenReassign(loan, s.allocationId, s.amount, s.funderName, e)}
                  >
                    <ArrowLeftRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span>
                      {s.funderName}: <strong className="text-primary font-bold">₹{s.amount.toLocaleString("en-IN")}</strong>
                      <span className="text-muted-foreground text-[10px] ml-1">({s.funderSharePercentage}%)</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/capital-management/${s.funderId}`);
                      }}
                      title="View in Capital Management"
                      className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {loan.funding.isPartiallyFunded && (
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                  <span className="text-[10px] text-amber-400 font-bold">
                    ₹{loan.funding.remainingRequired.toLocaleString("en-IN")} remaining
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAllocateCapital(loan);
                    }}
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Capital Person
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] text-muted-foreground">No capital person assigned</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAllocateCapital(loan);
                }}
                className="h-7 px-2.5 rounded-lg bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <Plus className="h-3 w-3" /> Add Capital Person
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-white/[0.03]">
        {!isSettled ? (
          <>
            <button
              onClick={() => onPay(loan)}
              className="h-9 px-3 flex-1 min-w-[70px] sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-secondary hover:bg-accent/40 text-primary text-xs font-bold whitespace-nowrap transition-all duration-200 fx-pressable"
            >
              <Landmark className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Pay</span>
            </button>
            <button
              onClick={() => onCurrentStatement(loan)}
              disabled={generatingStatementId === loan.loanId}
              className="h-9 px-3.5 flex-1 min-w-[115px] sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-secondary hover:bg-accent/40 text-primary text-xs font-bold whitespace-nowrap transition-all duration-200 fx-pressable disabled:opacity-50"
            >
              {generatingStatementId === loan.loanId ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Loan Status</span>
                </>
              )}
            </button>
          </>
        ) : null}

        <button
          onClick={() => onViewDetails(loan)}
          className="h-9 px-3.5 flex-1 min-w-[100px] sm:flex-initial flex items-center justify-center gap-1 rounded-xl bg-accent/25 hover:bg-accent/50 text-foreground text-xs font-semibold whitespace-nowrap transition-all duration-200"
        >
          <span>View Details</span>
        </button>

        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button
            onClick={(e) => onEditOpen(loan, e)}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
            title="Edit Borrower Details"
          >
            <Edit className="h-4 w-4 shrink-0" />
          </button>

          <button
            onClick={(e) => onDeleteLoan(loan.loanId, loan.borrower.name, e)}
            disabled={isPending}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            title="Delete Loan"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
});
