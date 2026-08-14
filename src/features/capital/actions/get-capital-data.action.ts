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
  investmentIndex?: number;
  totalFunderInvestments?: number;
  totalFunderCapitalProvided?: number;
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

    // 1. Fetch all funders / investment records
    const rawFunders = await capitalRepository.findAllFunders();
    // 2. Fetch all capital returns
    const rawReturns = await capitalRepository.findAllCapitalReturns();

    // Group returns by funderId (investment ID)
    const returnsByFunder: Record<string, typeof rawReturns> = {};
    rawReturns.forEach((r) => {
      if (!returnsByFunder[r.funderId]) {
        returnsByFunder[r.funderId] = [];
      }
      returnsByFunder[r.funderId].push(r);
    });

    // Group all investments by normalized mobile number
    const funderGroupMap: Record<string, typeof rawFunders> = {};
    rawFunders.forEach((f) => {
      const cleanMobile = f.mobile.replace(/[^0-9]/g, "").slice(-10) || f.mobile;
      if (!funderGroupMap[cleanMobile]) {
        funderGroupMap[cleanMobile] = [];
      }
      funderGroupMap[cleanMobile].push(f);
    });

    // 3. Map investment records with returns summary and portfolio metadata
    const funders: FunderWithReturns[] = rawFunders.map((f) => {
      const cleanMobile = f.mobile.replace(/[^0-9]/g, "").slice(-10) || f.mobile;
      const sameFunderInvestments = funderGroupMap[cleanMobile] || [f];
      
      // Sort investments of this funder chronologically
      sameFunderInvestments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const investmentIndex = sameFunderInvestments.findIndex((inv) => inv.funderId === f.funderId) + 1;
      const totalFunderInvestments = sameFunderInvestments.length;
      const totalFunderCapitalProvided = sameFunderInvestments.reduce((sum, inv) => sum + Number(inv.capitalAmount), 0);

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
        investmentIndex,
        totalFunderInvestments,
        totalFunderCapitalProvided,
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
