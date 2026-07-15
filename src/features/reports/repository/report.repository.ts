import { db } from "@/db/client";
import { loansTable, borrowersTable, paymentsTable } from "@/db/schema";
import { eq, and, sql, desc, asc, between, inArray } from "drizzle-orm";
import { PaginatedResult } from "@/types/api.types";
import { calculatePeriods, calculateMonthlyInterest, calculateOutstandingBalance } from "@/domain/interest-calculator";

export type OverdueReportRow = {
  loanId: string;
  borrowerName: string;
  mobile: string;
  principal: number;
  dueDate: string;
  daysOverdue: number;
  outstandingBalance: number;
};

export type OutstandingReportRow = {
  borrowerId: string;
  borrowerName: string;
  mobile: string;
  email: string | null;
  activeLoansCount: number;
  totalOutstanding: number;
  largestLoan: number;
};

export type InterestReportRow = {
  paymentId: string;
  paymentDate: string;
  borrowerName: string;
  loanId: string;
  principal: number;
  amount: number;
  notes: string | null;
};

export type ClosedReportRow = {
  loanId: string;
  borrowerName: string;
  principal: number;
  dateGiven: string;
  dateClosed: string;
  totalInterestCollected: number;
  durationMonths: number;
};

export class ReportRepository {
  private async getOutstandingBalanceForLoan(loan: any): Promise<number> {
    const paymentsResult = await db
      .select({ sum: sql<number>`sum(amount)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.loanId, loan.loanId));
    
    const totalPayments = Number(paymentsResult[0]?.sum || 0);
    const periods = calculatePeriods(loan.dateGiven, loan.dueDate);
    const monthlyInterest = calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate));
    const totalInterest = periods * monthlyInterest;
    
    return calculateOutstandingBalance(
      Number(loan.principal),
      totalInterest,
      Number(loan.penaltyAmount || 0),
      totalPayments
    );
  }

  async getOverdueLoans(
    page: number,
    pageSize: number
  ): Promise<PaginatedResult<OverdueReportRow>> {
    const offset = (page - 1) * pageSize;

    const [loansResult, [{ count }]] = await Promise.all([
      db
        .select({
          loan: loansTable,
          borrower: borrowersTable,
        })
        .from(loansTable)
        .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
        .where(eq(loansTable.status, "overdue"))
        .limit(pageSize)
        .offset(offset)
        .orderBy(asc(loansTable.dueDate)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(loansTable)
        .where(eq(loansTable.status, "overdue")),
    ]);

    const data: OverdueReportRow[] = [];
    const today = new Date();

    for (const item of loansResult) {
      if (item.borrower) {
        const outstandingBalance = await this.getOutstandingBalanceForLoan(item.loan);
        const due = new Date(item.loan.dueDate);
        const timeDiff = today.getTime() - due.getTime();
        const daysOverdue = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));

        data.push({
          loanId: item.loan.loanId,
          borrowerName: item.borrower.name,
          mobile: item.borrower.mobile,
          principal: Number(item.loan.principal),
          dueDate: item.loan.dueDate,
          daysOverdue,
          outstandingBalance,
        });
      }
    }

    const total = Number(count);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getOutstandingBalances(
    page: number,
    pageSize: number
  ): Promise<PaginatedResult<OutstandingReportRow>> {
    const offset = (page - 1) * pageSize;

    const allActiveLoans = await db
      .select({
        loan: loansTable,
        borrower: borrowersTable,
      })
      .from(loansTable)
      .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .where(inArray(loansTable.status, ["active", "overdue", "extended"]));

    const borrowerMap = new Map<string, {
      name: string;
      mobile: string;
      email: string | null;
      activeLoansCount: number;
      outstandingSum: number;
      largestLoan: number;
    }>();

    for (const item of allActiveLoans) {
      if (item.borrower) {
        const bId = item.borrower.borrowerId;
        const outstanding = await this.getOutstandingBalanceForLoan(item.loan);
        const principal = Number(item.loan.principal);

        const existing = borrowerMap.get(bId) || {
          name: item.borrower.name,
          mobile: item.borrower.mobile,
          email: item.borrower.email,
          activeLoansCount: 0,
          outstandingSum: 0,
          largestLoan: 0,
        };

        existing.activeLoansCount += 1;
        existing.outstandingSum += outstanding;
        existing.largestLoan = Math.max(existing.largestLoan, principal);

        borrowerMap.set(bId, existing);
      }
    }

    const allRows = Array.from(borrowerMap.entries()).map(([borrowerId, info]) => ({
      borrowerId,
      borrowerName: info.name,
      mobile: info.mobile,
      email: info.email,
      activeLoansCount: info.activeLoansCount,
      totalOutstanding: info.outstandingSum,
      largestLoan: info.largestLoan,
    })).sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    const total = allRows.length;
    const totalPages = Math.ceil(total / pageSize);
    const data = allRows.slice(offset, offset + pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getInterestEarned(
    dateFrom: string,
    dateTo: string,
    page: number,
    pageSize: number
  ): Promise<PaginatedResult<InterestReportRow>> {
    const offset = (page - 1) * pageSize;

    const [paymentsResult, [{ count }]] = await Promise.all([
      db
        .select({
          payment: paymentsTable,
          borrower: borrowersTable,
          loan: loansTable,
        })
        .from(paymentsTable)
        .leftJoin(loansTable, eq(paymentsTable.loanId, loansTable.loanId))
        .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
        .where(
          and(
            eq(paymentsTable.paymentType, "interest"),
            between(paymentsTable.paymentDate, dateFrom, dateTo)
          )
        )
        .limit(pageSize)
        .offset(offset)
        .orderBy(desc(paymentsTable.paymentDate)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.paymentType, "interest"),
            between(paymentsTable.paymentDate, dateFrom, dateTo)
          )
        ),
    ]);

    const data: InterestReportRow[] = paymentsResult.map((item) => ({
      paymentId: item.payment.paymentId,
      paymentDate: item.payment.paymentDate,
      borrowerName: item.borrower?.name || "Unknown",
      loanId: item.payment.loanId,
      principal: Number(item.loan?.principal || 0),
      amount: Number(item.payment.amount),
      notes: item.payment.notes,
    }));

    const total = Number(count);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getClosedLoans(
    dateFrom: string,
    dateTo: string,
    page: number,
    pageSize: number
  ): Promise<PaginatedResult<ClosedReportRow>> {
    const offset = (page - 1) * pageSize;

    const startTS = new Date(dateFrom);
    const endTS = new Date(dateTo);
    endTS.setHours(23, 59, 59, 999);

    const [loansResult, [{ count }]] = await Promise.all([
      db
        .select({
          loan: loansTable,
          borrower: borrowersTable,
        })
        .from(loansTable)
        .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
        .where(
          and(
            eq(loansTable.status, "closed"),
            between(loansTable.updatedAt, startTS, endTS)
          )
        )
        .limit(pageSize)
        .offset(offset)
        .orderBy(desc(loansTable.updatedAt)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(loansTable)
        .where(
          and(
            eq(loansTable.status, "closed"),
            between(loansTable.updatedAt, startTS, endTS)
          )
        ),
    ]);

    const data: ClosedReportRow[] = [];
    for (const item of loansResult) {
      if (item.borrower) {
        const paymentsRes = await db
          .select({ sum: sql<number>`sum(amount)` })
          .from(paymentsTable)
          .where(
            and(
              eq(paymentsTable.loanId, item.loan.loanId),
              eq(paymentsTable.paymentType, "interest")
            )
          );

        const totalInterestCollected = Number(paymentsRes[0]?.sum || 0);
        const durationMonths = calculatePeriods(item.loan.dateGiven, item.loan.dueDate);

        data.push({
          loanId: item.loan.loanId,
          borrowerName: item.borrower.name,
          principal: Number(item.loan.principal),
          dateGiven: item.loan.dateGiven,
          dateClosed: item.loan.updatedAt.toISOString().split("T")[0]!,
          totalInterestCollected,
          durationMonths,
        });
      }
    }

    const total = Number(count);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}

export const reportRepository = new ReportRepository();
