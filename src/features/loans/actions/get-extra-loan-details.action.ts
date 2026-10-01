"use server";

import { paymentRepository } from "@/features/payments/repository/payment.repository";
import { notificationLogRepository } from "@/features/notifications/repository/notification-log.repository";
import { loanCycleRepository } from "../repository/loan-cycle.repository";
import { loanRepository } from "../repository/loan.repository";
import { decrypt } from "@/lib/encryption";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import { capitalAllocationsTable, fundersTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { ActionResult } from "@/types/api.types";
import type { Payment, NotificationLog } from "@/db/schema";
import type { LoanCycle } from "@/db/schema/loan-cycles";
import type { LoanFundingSource, LoanFundingSummary } from "./get-loan-management-data.action";

export type ExtraLoanDetails = {
  payments: Payment[];
  notifications: NotificationLog[];
  cycles: LoanCycle[];
  panDecrypted?: string;
  aadhaarDecrypted?: string;
  funding?: LoanFundingSummary;
};

export async function getExtraLoanDetailsAction(loanId: string): Promise<ActionResult<ExtraLoanDetails>> {
  try {
    await requireAuth();
    const [payments, notifications, cycles, loan, rawAllocations] = await Promise.all([
      paymentRepository.findByLoanId(loanId),
      notificationLogRepository.findByLoanId(loanId),
      loanCycleRepository.findByLoanId(loanId),
      loanRepository.findById(loanId),
      db
        .select({
          allocationId: capitalAllocationsTable.allocationId,
          funderId: capitalAllocationsTable.funderId,
          funderName: fundersTable.name,
          funderMobile: fundersTable.mobile,
          amount: capitalAllocationsTable.amount,
          allocationDate: capitalAllocationsTable.allocationDate,
          notes: capitalAllocationsTable.notes,
        })
        .from(capitalAllocationsTable)
        .innerJoin(fundersTable, eq(capitalAllocationsTable.funderId, fundersTable.funderId))
        .where(
          and(
            eq(capitalAllocationsTable.loanId, loanId),
            eq(capitalAllocationsTable.status, "active")
          )
        ),
    ]);

    let panDecrypted = "";
    let aadhaarDecrypted = "";
    if (loan?.borrower) {
      try {
        panDecrypted = decrypt(loan.borrower.panEncrypted);
        aadhaarDecrypted = decrypt(loan.borrower.aadhaarEncrypted);
      } catch (e) {
        panDecrypted = "DECRYPTION_ERROR";
        aadhaarDecrypted = "DECRYPTION_ERROR";
      }
    }

    const principal = loan ? Number(loan.principal) : 0;
    const sources: LoanFundingSource[] = rawAllocations.map((a) => {
      const amt = Number(a.amount);
      const share = principal > 0 ? (amt / principal) * 100 : 0;
      return {
        allocationId: a.allocationId,
        funderId: a.funderId,
        funderName: a.funderName,
        funderMobile: a.funderMobile,
        amount: amt,
        funderSharePercentage: Math.round(share),
        allocationDate: a.allocationDate,
        notes: a.notes,
      };
    });

    const totalFunded = sources.reduce((sum, s) => sum + s.amount, 0);
    const remainingRequired = Math.max(0, principal - totalFunded);
    const funding: LoanFundingSummary = {
      totalFunded,
      remainingRequired,
      isFullyFunded: totalFunded >= principal,
      isPartiallyFunded: totalFunded > 0 && totalFunded < principal,
      isUnfunded: totalFunded === 0,
      sources,
    };

    return {
      success: true,
      data: {
        payments,
        notifications,
        cycles,
        panDecrypted,
        aadhaarDecrypted,
        funding,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch extra loan details" };
  }
}
