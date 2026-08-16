"use server";

import { recordPaymentSchema } from "../schemas/record-payment.schema";
import { paymentRepository } from "../repository/payment.repository";
import { loanRepository } from "@/features/loans/repository/loan.repository";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { PaymentCompletedResultPayload } from "@/features/loans/utils/generate-payment-completed-pdf";
import { paymentReminderRepository } from "@/features/notifications/repository/payment-reminder.repository";

export async function recordPaymentAction(
  _prevState: ActionResult<PaymentCompletedResultPayload> | null,
  formData: FormData
): Promise<ActionResult<PaymentCompletedResultPayload>> {
  try {
    await requireAuth();

    const raw = Object.fromEntries(formData);
    const parsed = recordPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      parsed.error.issues.forEach((err) => {
        const path = err.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(err.message);
      });
      return { success: false, error: fieldErrors };
    }

    const { loanId, amount, paymentType, paymentDate, notes } = parsed.data;

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.status === "closed") {
      return { success: false, error: "Cannot record payments against a closed loan" };
    }

    const previousOutstanding = await paymentRepository.getOutstandingBalance(loanId);

    const createdPayment = await paymentRepository.create({
      loanId,
      amount: amount.toString(),
      paymentType,
      paymentDate,
      notes: notes || null,
    });

    const allPayments = await paymentRepository.findByLoanId(loanId);

    const dateFormatted = paymentDate.replace(/-/g, "");
    const randomSeq = Math.floor(1000 + Math.random() * 9000).toString();
    const documentId = `FIN-PAY-${dateFormatted}-${randomSeq}`;
    const transactionId = createdPayment.paymentId || (createdPayment as any).id || `TXN-${dateFormatted}-${randomSeq}`;

    const borrower = loan.borrower;
    const principalNum = Number(loan.principal || 0);
    const rateNum = Number(loan.interestRate || 0);
    const monthlyInterestAmount = Math.round((principalNum * rateNum) / 1000);
    const penaltyNum = Number(loan.penaltyAmount || 0);

    // Total Payable = Principal + Accrued Interest + Penalty
    const totalPayable = principalNum + monthlyInterestAmount + penaltyNum;

    // Find position of current payment in history
    const createdIndex = allPayments.findIndex(
      (p) => (p.paymentId || (p as any).id) === (createdPayment.paymentId || (createdPayment as any).id)
    );

    const previousPaidAmount = allPayments
      .slice(0, createdIndex >= 0 ? createdIndex : allPayments.length - 1)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const currentPaymentAmount = Number(amount);
    const totalAmountPaidToDate = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remainingBalance = Math.max(0, totalPayable - totalAmountPaidToDate);

    const isFullyCleared = remainingBalance <= 0;
    let finalStatus: string = loan.status;

    if (isFullyCleared) {
      await loanRepository.close(loanId);
      await paymentReminderRepository.cancelRemindersForLoan(loanId);
      await auditLog("loan_closed", "loan", loanId, { triggeredBy: "payment" });
      finalStatus = "closed";
    }

    await auditLog("payment_recorded", "payment", undefined, {
      loanId,
      amount,
      paymentType,
      outstandingBalance: remainingBalance,
    });

    // Compute cumulative history for every payment row
    let accumPaid = 0;
    const paymentsHistory = allPayments.map((p, idx) => {
      const pAmt = Number(p.amount || 0);
      accumPaid += pAmt;
      const pBal = Math.max(0, totalPayable - accumPaid);
      const rcNo = `RC-${(p.paymentDate || "").replace(/-/g, "")}-${String(idx + 1).padStart(3, "0")}`;
      return {
        paymentId: p.paymentId || (p as any).id,
        paymentDate: p.paymentDate,
        date: p.paymentDate,
        receiptNo: rcNo,
        amount: pAmt,
        amountPaid: pAmt,
        totalPaid: accumPaid,
        balance: pBal,
        paymentType: p.paymentType,
        notes: p.notes,
      };
    });

    const paymentStatus: "PARTIAL PAYMENT" | "PAID / COMPLETED" = isFullyCleared
      ? "PAID / COMPLETED"
      : "PARTIAL PAYMENT";

    const currentReceiptNo = `RC-${dateFormatted}-${String(createdIndex >= 0 ? createdIndex + 1 : allPayments.length).padStart(3, "0")}`;

    return {
      success: true,
      data: {
        documentId,
        receiptNumber: currentReceiptNo,
        transactionId,
        paymentDate,
        paymentAmount: currentPaymentAmount,
        paymentType,
        notes,

        loanId: loan.loanId,
        borrowerName: borrower.name,
        borrowerMobile: borrower.mobile,
        fatherName: (borrower as any).fatherName || (borrower as any).father_name || undefined,
        fatherMobile: (borrower as any).fatherMobile || (borrower as any).father_mobile || undefined,
        email: borrower.email || undefined,
        address: (borrower as any).address || undefined,
        panDecrypted: (borrower as any).panDecrypted || undefined,
        aadhaarDecrypted: (borrower as any).aadhaarDecrypted || undefined,
        locationUrl: borrower.locationUrl || undefined,

        dateGiven: loan.dateGiven,
        dueDate: loan.dueDate,
        principal: principalNum,
        interestRate: rateNum,
        interestType: loan.interestType || "monthly",
        monthlyInterestAmount,

        principalPaid: paymentType === "principal" ? currentPaymentAmount : 0,
        interestPaid: paymentType === "interest" ? currentPaymentAmount : 0,
        penaltyPaid: paymentType === "penalty" ? currentPaymentAmount : 0,

        previousOutstanding,
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

        loanStatus: finalStatus.toUpperCase(),
        isFullyCleared,

        paymentsHistory,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record payment" };
  }
}
