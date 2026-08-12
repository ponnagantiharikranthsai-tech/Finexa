"use server";

import { recordPaymentSchema } from "../schemas/record-payment.schema";
import { paymentRepository } from "../repository/payment.repository";
import { loanRepository } from "@/features/loans/repository/loan.repository";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";
import type { PaymentCompletedResultPayload } from "@/features/loans/utils/generate-payment-completed-pdf";

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

    const remainingOutstanding = await paymentRepository.getOutstandingBalance(loanId);

    const isFullyCleared = remainingOutstanding <= 0;
    let finalStatus: string = loan.status;

    if (isFullyCleared) {
      await loanRepository.close(loanId);
      await auditLog("loan_closed", "loan", loanId, { triggeredBy: "payment" });
      finalStatus = "closed";
    }

    await auditLog("payment_recorded", "payment", undefined, {
      loanId,
      amount,
      paymentType,
      outstandingBalance: remainingOutstanding,
    });

    const allPayments = await paymentRepository.findByLoanId(loanId);
    const totalAmountPaidToDate = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const dateFormatted = paymentDate.replace(/-/g, "");
    const randomSeq = Math.floor(1000 + Math.random() * 9000).toString();
    const documentId = `FIN-PAY-${dateFormatted}-${randomSeq}`;
    const transactionId = createdPayment.paymentId || (createdPayment as any).id || `TXN-${dateFormatted}-${randomSeq}`;

    const borrower = loan.borrower;
    const principalNum = Number(loan.principal || 0);
    const rateNum = Number(loan.interestRate || 0);

    return {
      success: true,
      data: {
        documentId,
        transactionId,
        paymentDate,
        paymentAmount: Number(amount),
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
        monthlyInterestAmount: Math.round((principalNum * rateNum) / 1000),

        principalPaid: paymentType === "principal" ? Number(amount) : 0,
        interestPaid: paymentType === "interest" ? Number(amount) : 0,
        penaltyPaid: paymentType === "penalty" ? Number(amount) : 0,

        previousOutstanding,
        remainingOutstanding,
        totalPayableAfterPayment: remainingOutstanding,
        totalAmountPaidToDate,
        totalInterestAccrued: Math.round((principalNum * rateNum) / 1000),
        totalPenaltyAccrued: Number(loan.penaltyAmount || 0),

        loanStatus: finalStatus.toUpperCase(),
        isFullyCleared,

        paymentsHistory: allPayments.map((p) => ({
          paymentId: p.paymentId || (p as any).id,
          paymentDate: p.paymentDate,
          amount: Number(p.amount),
          paymentType: p.paymentType,
          notes: p.notes,
        })),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record payment" };
  }
}
