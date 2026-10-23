"use server";

import { loanRepository } from "../repository/loan.repository";
import { paymentRepository } from "@/features/payments/repository/payment.repository";
import { loanCycleRepository } from "../repository/loan-cycle.repository";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { calculateDueDate, calculateCustomDueDate } from "@/domain/due-date-calculator";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import { paymentReminderRepository } from "@/features/notifications/repository/payment-reminder.repository";

export type PayAndExtendResultPayload = {
  documentId: string;
  newDueDate: string;
  amountPaid: number;
  nextCycleName: string;
  loanId: string;
  borrowerName: string;
  borrowerMobile: string;
  fatherName?: string;
  fatherMobile?: string;
  locationUrl?: string;
  dateGiven: string;
  billingStartDate: string;
  previousDueDate: string;
  principal: number;
  interestRate: number;
  monthlyInterest: number;
  remainingPrincipal: number;
  paymentDate: string;
  loanStatus: string;
};

export type PayAndExtendOptions = {
  paymentDate?: string;
  notes?: string;
  months?: number;
  days?: number;
};

export async function payAndExtendAction(
  loanId: string,
  paymentDateOrOptions?: string | PayAndExtendOptions,
  notesInput?: string,
  extensionMonths: number = 1
): Promise<ActionResult<PayAndExtendResultPayload>> {
  try {
    await requireAuth();

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.status === "closed") {
      return { success: false, error: "Cannot pay & extend a closed loan file." };
    }

    const todayStr = new Date().toISOString().split("T")[0]!;

    const isOptions = typeof paymentDateOrOptions === "object" && paymentDateOrOptions !== null;
    const actualPaymentDate = (isOptions ? paymentDateOrOptions.paymentDate : paymentDateOrOptions) || todayStr;
    const actualNotes = isOptions ? paymentDateOrOptions.notes : notesInput;
    const months = isOptions ? paymentDateOrOptions.months : (typeof extensionMonths === "number" ? extensionMonths : 1);
    const days = isOptions ? paymentDateOrOptions.days : undefined;

    const principalNum = Number(loan.principal || 0);
    const rateNum = Number(loan.interestRate || 0);
    const monthlyInterest = calculateMonthlyInterest(principalNum, rateNum);

    const currentDueDate = new Date(loan.dueDate);
    let newDueDateObj: Date;
    let durationLabel = "";
    let interestMultiplier = 1;

    if (days && days > 0) {
      newDueDateObj = calculateCustomDueDate(currentDueDate, days);
      durationLabel = `${days} Days`;
      interestMultiplier = Number((days / 30).toFixed(2));
    } else {
      const monthsMultiplier = Math.max(1, months || 1);
      newDueDateObj = calculateDueDate(currentDueDate, loan.interestType, monthsMultiplier);
      durationLabel = `${monthsMultiplier} Month${monthsMultiplier > 1 ? "s" : ""}`;
      interestMultiplier = monthsMultiplier;
    }

    const interestAmountPaid = Math.max(0, Math.round(monthlyInterest * interestMultiplier));

    if (interestAmountPaid <= 0) {
      return { success: false, error: "Interest amount must be greater than 0 to extend." };
    }

    // Generate Unique Document ID: FIN-REC-YYYYMMDD-XXXX
    const dateFormatted = actualPaymentDate.replace(/-/g, "");
    const randomSeq = Math.floor(1000 + Math.random() * 9000).toString();
    const documentId = `FIN-REC-${dateFormatted}-${randomSeq}`;

    // 1. Record Interest Payment in payments table
    await paymentRepository.create({
      loanId,
      amount: interestAmountPaid.toString(),
      paymentType: "interest",
      paymentDate: actualPaymentDate,
      notes: actualNotes
        ? `[Pay & Extend | ${documentId} | +${durationLabel}] ${actualNotes}`
        : `[Pay & Extend | ${documentId}] ${durationLabel} interest payment of ₹${interestAmountPaid.toLocaleString("en-IN")}`,
    });

    // 2. Extend Due Date by period
    const newDueDateStr = newDueDateObj.toISOString().split("T")[0]!;

    await loanRepository.updateDueDate(loanId, newDueDateObj);
    await loanRepository.updateStatus(loanId, "extended");
    await paymentReminderRepository.recalculateScheduleForExtension(loanId, newDueDateStr);

    // 3. Record Permanent Cycle History
    const existingCycles = await loanCycleRepository.findByLoanId(loanId);
    const cycleNum = existingCycles.length + 1;

    await loanCycleRepository.create({
      loanId,
      cycleNumber: cycleNum,
      startDate: loan.dateGiven,
      originalDueDate: loan.dueDate,
      actualPaymentDate,
      principalAmount: loan.principal,
      interestAmount: interestAmountPaid.toString(),
      interestPaid: interestAmountPaid.toString(),
      penaltyAmount: "0",
      penaltyPaid: "0",
      totalPaid: interestAmountPaid.toString(),
      remainingPrincipal: loan.principal, // Principal remains 100% outstanding!
      cycleStatus: "extended",
      paymentType: "pay_and_extend",
      notes: actualNotes ? `[${documentId}] ${actualNotes}` : `[${documentId}] Monthly interest cleared; loan principal extended by ${durationLabel} to next cycle.`,
    });

    await auditLog("loan_pay_and_extend", "loan", loanId, {
      documentId,
      interestPaid: interestAmountPaid,
      previousDueDate: loan.dueDate,
      newDueDate: newDueDateStr,
      durationLabel,
      principalOutstanding: loan.principal,
    });

    const nextCycleMonth = newDueDateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const borrower = loan.borrower;

    return {
      success: true,
      data: {
        documentId,
        newDueDate: newDueDateStr,
        amountPaid: interestAmountPaid,
        nextCycleName: nextCycleMonth,
        loanId: loan.loanId,
        borrowerName: borrower.name,
        borrowerMobile: borrower.mobile,
        fatherName: (borrower as any).fatherName || (borrower as any).father_name || undefined,
        fatherMobile: (borrower as any).fatherMobile || (borrower as any).father_mobile || undefined,
        locationUrl: borrower.locationUrl || undefined,
        dateGiven: loan.dateGiven,
        billingStartDate: loan.dateGiven,
        previousDueDate: loan.dueDate,
        principal: principalNum,
        interestRate: rateNum,
        monthlyInterest: interestAmountPaid,
        remainingPrincipal: principalNum,
        paymentDate: actualPaymentDate,
        loanStatus: "ACTIVE / EXTENDED",
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to process Pay & Extend" };
  }
}
