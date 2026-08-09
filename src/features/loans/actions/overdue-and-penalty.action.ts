"use server";

import { loanRepository } from "../repository/loan.repository";
import { paymentRepository } from "@/features/payments/repository/payment.repository";
import { loanCycleRepository } from "../repository/loan-cycle.repository";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { calculateAccruedPenalty } from "@/domain/penalty-calculator";
import { calculateDueDate } from "@/domain/due-date-calculator";
import { db } from "@/db/client";
import { penaltyLedgerTable } from "@/db/schema/loans";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function overdueAndPenaltyAction(
  loanId: string,
  paymentDateInput?: string,
  notesInput?: string
): Promise<ActionResult<{ newDueDate: string; totalPaid: number; interestPaid: number; penaltyPaid: number }>> {
  try {
    await requireAuth();

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.status === "closed") {
      return { success: false, error: "Cannot process overdue settlement for a closed loan file." };
    }

    const todayStr = new Date().toISOString().split("T")[0]!;
    const actualClearanceDateStr = paymentDateInput || todayStr;
    const actualClearanceDate = new Date(actualClearanceDateStr);

    const principalNum = Number(loan.principal || 0);
    const rateNum = Number(loan.interestRate || 0);
    const monthlyInterest = calculateMonthlyInterest(principalNum, rateNum);
    const interestPaid = Math.max(0, Math.round(monthlyInterest));

    // Calculate accrued penalty dynamically
    const penaltyResult = calculateAccruedPenalty({
      principal: principalNum,
      dueDate: loan.dueDate,
      status: loan.status,
      penaltyRate: Number(loan.penaltyRate || 50),
      manualPenaltyAmount: Number(loan.penaltyAmount || 0),
    });

    const penaltyPaid = Math.max(0, Math.round(penaltyResult.totalPenalty));
    const totalPaid = interestPaid + penaltyPaid;

    if (totalPaid <= 0) {
      return { success: false, error: "Total payment amount must be greater than 0." };
    }

    // 1. Record Interest Payment
    await paymentRepository.create({
      loanId,
      amount: interestPaid.toString(),
      paymentType: "interest",
      paymentDate: actualClearanceDateStr,
      notes: notesInput ? `[Overdue Settlement] Interest: ${notesInput}` : `[Overdue Settlement] Cleared monthly interest ₹${interestPaid.toLocaleString("en-IN")}`,
    });

    // 2. Record Penalty Payment if applicable
    if (penaltyPaid > 0) {
      await paymentRepository.create({
        loanId,
        amount: penaltyPaid.toString(),
        paymentType: "penalty",
        paymentDate: actualClearanceDateStr,
        notes: `[Overdue Settlement] Cleared late penalty ₹${penaltyPaid.toLocaleString("en-IN")} (${penaltyResult.daysOverdue} days overdue)`,
      });

      // Insert Penalty Ledger audit entry
      try {
        await db.insert(penaltyLedgerTable).values({
          loanId,
          calculationDate: actualClearanceDateStr,
          daysOverdue: penaltyResult.daysOverdue.toString(),
          penaltyAdded: penaltyPaid.toString(),
          outstandingBefore: (interestPaid + penaltyPaid).toString(),
          outstandingAfter: "0",
          adminName: "System Administrator",
          remarks: `Overdue interest + penalty settled on ${actualClearanceDateStr}`,
        });
      } catch (e: any) {
        console.error("Penalty ledger log warning:", e.message);
      }
    }

    // 3. Start New Cycle from Actual Clearance Date (Rule #9)
    const newDueDateObj = calculateDueDate(actualClearanceDate);
    const newDueDateStr = newDueDateObj.toISOString().split("T")[0]!;

    // Update loan: new cycle starts from clearance date, due date updated, status set to active, penalty reset
    await loanRepository.updateDueDate(loanId, newDueDateObj);
    await loanRepository.updateStatus(loanId, "active");
    await loanRepository.resetPenalty(loanId);

    // 4. Record Permanent Cycle History
    const existingCycles = await loanCycleRepository.findByLoanId(loanId);
    const cycleNum = existingCycles.length + 1;

    await loanCycleRepository.create({
      loanId,
      cycleNumber: cycleNum,
      startDate: loan.dateGiven,
      originalDueDate: loan.dueDate,
      actualPaymentDate: actualClearanceDateStr,
      principalAmount: loan.principal,
      interestAmount: interestPaid.toString(),
      interestPaid: interestPaid.toString(),
      penaltyAmount: penaltyPaid.toString(),
      penaltyPaid: penaltyPaid.toString(),
      totalPaid: totalPaid.toString(),
      remainingPrincipal: loan.principal, // Principal remains 100% outstanding!
      cycleStatus: "overdue_closed",
      paymentType: "overdue_penalty",
      notes: notesInput || `Overdue cycle closed. Cleared interest ₹${interestPaid} & penalty ₹${penaltyPaid}. New cycle started on ${actualClearanceDateStr}.`,
    });

    await auditLog("loan_overdue_penalty_cleared", "loan", loanId, {
      interestPaid,
      penaltyPaid,
      totalPaid,
      actualClearanceDate: actualClearanceDateStr,
      newDueDate: newDueDateStr,
      principalOutstanding: loan.principal,
    });

    return {
      success: true,
      data: {
        newDueDate: newDueDateStr,
        totalPaid,
        interestPaid,
        penaltyPaid,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to process Overdue & Penalty payment" };
  }
}
