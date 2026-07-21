"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db/client";
import { fundersTable, capitalReturnsTable, loansTable, paymentsTable } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { capitalRepository } from "../repository/capital.repository";

export interface FunderWithReturns {
  funderId: string;
  name: string;
  mobile: string;
  address: string;
  capitalAmount: number;
  investmentDate: string;
  returnDueDate: string;
  status: "active" | "returned";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalReturned: number;
  remainingCapital: number;
  returnsList: {
    returnId: string;
    amount: number;
    returnDate: string;
    notes: string | null;
    createdAt: string;
  }[];
}

export async function getCapitalDataAction() {
  try {
    await requireAuth();

    // 1. Fetch all funders
    const rawFunders = await capitalRepository.findAllFunders();
    // 2. Fetch all returns
    const rawReturns = await capitalRepository.findAllCapitalReturns();

    // Group returns by funderId
    const returnsByFunder: Record<string, typeof rawReturns> = {};
    rawReturns.forEach((r) => {
      if (!returnsByFunder[r.funderId]) {
        returnsByFunder[r.funderId] = [];
      }
      returnsByFunder[r.funderId].push(r);
    });

    // 3. Map funders with returns summary
    const funders: FunderWithReturns[] = rawFunders.map((f) => {
      const funderReturns = returnsByFunder[f.funderId] || [];
      const totalReturned = funderReturns.reduce((sum, r) => sum + Number(r.amount), 0);
      const remainingCapital = Math.max(0, Number(f.capitalAmount) - totalReturned);

      return {
        funderId: f.funderId,
        name: f.name,
        mobile: f.mobile,
        address: f.address,
        capitalAmount: Number(f.capitalAmount),
        investmentDate: f.investmentDate,
        returnDueDate: f.returnDueDate,
        status: f.status as "active" | "returned",
        notes: f.notes,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        totalReturned,
        remainingCapital,
        returnsList: funderReturns.map((r) => ({
          returnId: r.returnId,
          amount: Number(r.amount),
          returnDate: r.returnDate,
          notes: r.notes,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    });

    // 4. Calculate stats
    const totalReceived = funders.reduce((sum, f) => sum + f.capitalAmount, 0);
    const totalReturned = rawReturns.reduce((sum, r) => sum + Number(r.amount), 0);
    const activeCapital = Math.max(0, totalReceived - totalReturned);

    // Calculate outstanding loans principal (active/overdue/extended/submitted)
    const activeLoans = await db
      .select({
        loanId: loansTable.loanId,
        principal: loansTable.principal,
      })
      .from(loansTable)
      .where(inArray(loansTable.status, ["submitted", "active", "overdue", "extended"]));

    let totalOutstandingLoansPrincipal = 0;
    if (activeLoans.length > 0) {
      const activeLoanIds = activeLoans.map((l) => l.loanId);
      const repayments = await db
        .select({
          loanId: paymentsTable.loanId,
          amount: paymentsTable.amount,
        })
        .from(paymentsTable)
        .where(
          and(
            inArray(paymentsTable.loanId, activeLoanIds),
            eq(paymentsTable.paymentType, "principal")
          )
        );

      const repaymentsMap: Record<string, number> = {};
      repayments.forEach((r) => {
        repaymentsMap[r.loanId] = (repaymentsMap[r.loanId] || 0) + Number(r.amount);
      });

      activeLoans.forEach((loan) => {
        const paid = repaymentsMap[loan.loanId] || 0;
        const outstanding = Math.max(0, Number(loan.principal) - paid);
        totalOutstandingLoansPrincipal += outstanding;
      });
    }

    const availableCapital = Math.max(0, activeCapital - totalOutstandingLoansPrincipal);
    const activeFunders = funders.filter((f) => f.status === "active").length;

    return {
      success: true,
      data: {
        funders,
        stats: {
          totalReceived,
          totalReturned,
          activeCapital,
          availableCapital,
          activeFunders,
          totalOutstandingLoansPrincipal,
        },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || "Failed to fetch capital data.",
    };
  }
}
