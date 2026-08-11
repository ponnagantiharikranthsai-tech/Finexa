"use server";

import { loanRepository } from "../repository/loan.repository";
import { loanCycleRepository } from "../repository/loan-cycle.repository";
import { calculateDueDate } from "@/domain/due-date-calculator";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { PayAndExtendResultPayload } from "./pay-and-extend.action";

export async function extendLoanAction(
  loanId: string
): Promise<ActionResult<PayAndExtendResultPayload>> {
  try {
    await requireAuth();

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.status === "closed") {
      return { success: false, error: "Cannot extend a closed loan" };
    }

    if (loan.status !== "overdue" && loan.status !== "active" && loan.status !== "extended") {
      return { success: false, error: "Cannot extend this loan in its current status." };
    }

    const today = new Date().toISOString().split("T")[0]!;

    const principalNum = Number(loan.principal || 0);
    const rateNum = Number(loan.interestRate || 0);
    const monthlyInterest = calculateMonthlyInterest(principalNum, rateNum);

    const currentDueDate = new Date(loan.dueDate);
    const newDueDateDate = calculateDueDate(currentDueDate);
    const newDueDateStr = newDueDateDate.toISOString().split("T")[0]!;

    const dateFormatted = today.replace(/-/g, "");
    const randomSeq = Math.floor(1000 + Math.random() * 9000).toString();
    const documentId = `FIN-EXT-${dateFormatted}-${randomSeq}`;

    await loanRepository.updateDueDate(loanId, newDueDateDate);
    await loanRepository.updateStatus(loanId, "extended");

    const existingCycles = await loanCycleRepository.findByLoanId(loanId);
    const cycleNum = existingCycles.length + 1;

    await loanCycleRepository.create({
      loanId,
      cycleNumber: cycleNum,
      startDate: loan.dateGiven,
      originalDueDate: loan.dueDate,
      actualPaymentDate: today,
      principalAmount: loan.principal,
      interestAmount: monthlyInterest.toString(),
      interestPaid: "0",
      penaltyAmount: "0",
      penaltyPaid: "0",
      totalPaid: "0",
      remainingPrincipal: loan.principal,
      cycleStatus: "extended",
      paymentType: "extension",
      notes: `[${documentId}] Loan term extended to ${newDueDateStr}.`,
    });

    await auditLog("loan_extended", "loan", loanId, {
      documentId,
      previousDueDate: loan.dueDate,
      newDueDate: newDueDateStr,
    });

    const nextCycleMonth = newDueDateDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const borrower = loan.borrower;

    return {
      success: true,
      data: {
        documentId,
        newDueDate: newDueDateStr,
        amountPaid: 0,
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
        monthlyInterest: Math.round(monthlyInterest),
        remainingPrincipal: principalNum,
        paymentDate: today,
        loanStatus: "ACTIVE / EXTENDED",
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to extend loan" };
  }
}
