import { db } from "@/db/client";
import { loansTable, borrowersTable, paymentsTable, loanApplicationsTable, notificationsLogTable, auditLogTable, type Loan, type InsertLoan, type LoanStatus, type Borrower } from "@/db/schema";
import { eq, or, like, sql, and, inArray, asc, desc } from "drizzle-orm";
import { PaginatedResult } from "@/types/api.types";
import { calculatePeriods, calculateMonthlyInterest, calculateOutstandingBalance } from "@/domain/interest-calculator";

export type LoanWithBorrower = Loan & {
  borrower: Borrower;
  outstandingBalance: number;
  monthlyInterestAmount: number;
};

export type LoanFilters = {
  status?: LoanStatus;
  search?: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
};

export type DashboardStats = {
  activeCount: number;
  totalOutstanding: number;
  overdueCount: number;
  dueSoonCount: number;
  borrowersCount: number;
  totalAmountLent: number;
  totalAmountCollected: number;
  todaysCollections: number;
  dueTodayCount: number;
};

export class LoanRepository {
  async getOutstandingBalancesForLoans(loans: Loan[]): Promise<Map<string, number>> {
    const loanIds = loans.map(l => l.loanId);
    const balanceMap = new Map<string, number>();
    if (loanIds.length === 0) return balanceMap;

    const paymentsSums = await db
      .select({ loanId: paymentsTable.loanId, sum: sql<number>`sum(amount)` })
      .from(paymentsTable)
      .where(inArray(paymentsTable.loanId, loanIds))
      .groupBy(paymentsTable.loanId);

    const paymentsMap = new Map<string, number>();
    paymentsSums.forEach(p => {
      paymentsMap.set(p.loanId, Number(p.sum || 0));
    });

    for (const loan of loans) {
      const totalPayments = paymentsMap.get(loan.loanId) || 0;
      const periods = calculatePeriods(loan.dateGiven, loan.dueDate);
      const monthlyInterest = calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate));
      const totalInterest = periods * monthlyInterest;
      
      const balance = calculateOutstandingBalance(
        Number(loan.principal),
        totalInterest,
        Number(loan.penaltyAmount || 0),
        totalPayments
      );
      balanceMap.set(loan.loanId, balance);
    }

    return balanceMap;
  }

  async getOutstandingBalanceForLoan(loan: Loan): Promise<number> {
    const balances = await this.getOutstandingBalancesForLoans([loan]);
    return balances.get(loan.loanId) || 0;
  }

  async create(data: InsertLoan): Promise<Loan> {
    const [inserted] = await db.insert(loansTable).values(data).returning();
    if (!inserted) {
      throw new Error("Failed to insert loan");
    }
    return inserted;
  }

  async findById(id: string): Promise<LoanWithBorrower | null> {
    const [result] = await db
      .select({
        loan: loansTable,
        borrower: borrowersTable,
      })
      .from(loansTable)
      .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .where(eq(loansTable.loanId, id))
      .limit(1);

    if (!result || !result.borrower) return null;

    const outstandingBalance = await this.getOutstandingBalanceForLoan(result.loan);
    const monthlyInterestAmount = calculateMonthlyInterest(
      Number(result.loan.principal),
      Number(result.loan.interestRate)
    );

    return {
      ...result.loan,
      borrower: result.borrower,
      outstandingBalance,
      monthlyInterestAmount,
    };
  }

  async findMany(
    filters: LoanFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<LoanWithBorrower>> {
    const { status, search } = filters;
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status) {
      conditions.push(eq(loansTable.status, status));
    }
    if (search) {
      conditions.push(
        or(
          like(borrowersTable.name, `%${search}%`),
          like(borrowersTable.mobile, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rawLoans, [{ count }]] = await Promise.all([
      db
        .select({
          loan: loansTable,
          borrower: borrowersTable,
        })
        .from(loansTable)
        .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
        .where(whereClause)
        .limit(pageSize)
        .offset(offset)
        .orderBy(desc(loansTable.createdAt)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(loansTable)
        .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
        .where(whereClause),
    ]);

    const loansOnly = rawLoans.map(item => item.loan);
    const outstandingBalancesMap = await this.getOutstandingBalancesForLoans(loansOnly);

    const data: LoanWithBorrower[] = [];
    for (const item of rawLoans) {
      if (item.borrower) {
        const outstandingBalance = outstandingBalancesMap.get(item.loan.loanId) || 0;
        const monthlyInterestAmount = calculateMonthlyInterest(
          Number(item.loan.principal),
          Number(item.loan.interestRate)
        );
        data.push({
          ...item.loan,
          borrower: item.borrower,
          outstandingBalance,
          monthlyInterestAmount,
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

  async updateStatus(id: string, status: LoanStatus): Promise<void> {
    await db
      .update(loansTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(loansTable.loanId, id));
  }

  async updateDueDate(id: string, dueDate: Date): Promise<void> {
    // format as YYYY-MM-DD
    const formatted = dueDate.toISOString().split("T")[0];
    if (!formatted) throw new Error("Invalid date");
    await db
      .update(loansTable)
      .set({ dueDate: formatted, updatedAt: new Date() })
      .where(eq(loansTable.loanId, id));
  }

  async updatePenalty(id: string, penaltyAmount: number): Promise<void> {
    await db
      .update(loansTable)
      .set({ penaltyAmount: penaltyAmount.toString(), updatedAt: new Date() })
      .where(eq(loansTable.loanId, id));
  }

  async close(id: string): Promise<void> {
    await this.updateStatus(id, "closed");
  }

  async getOverdueAndUpcoming(): Promise<LoanWithBorrower[]> {
    // Overdue or due within 3 days
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    const formattedToday = today.toISOString().split("T")[0];
    const formattedThreeDays = threeDaysFromNow.toISOString().split("T")[0];

    const rawLoans = await db
      .select({
        loan: loansTable,
        borrower: borrowersTable,
      })
      .from(loansTable)
      .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .where(
        and(
          inArray(loansTable.status, ["active", "overdue", "extended"]),
          or(
            eq(loansTable.status, "overdue"),
            sql`${loansTable.dueDate} <= ${formattedThreeDays}`
          )
        )
      )
      .orderBy(asc(loansTable.dueDate));

    const loansOnly = rawLoans.map(item => item.loan);
    const outstandingBalancesMap = await this.getOutstandingBalancesForLoans(loansOnly);

    const result: LoanWithBorrower[] = [];
    for (const item of rawLoans) {
      if (item.borrower) {
        const outstandingBalance = outstandingBalancesMap.get(item.loan.loanId) || 0;
        const monthlyInterestAmount = calculateMonthlyInterest(
          Number(item.loan.principal),
          Number(item.loan.interestRate)
        );
        result.push({
          ...item.loan,
          borrower: item.borrower,
          outstandingBalance,
          monthlyInterestAmount,
        });
      }
    }
    return result;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const formattedToday = today.toISOString().split("T")[0];
    const formattedSevenDays = sevenDaysFromNow.toISOString().split("T")[0];

  const [
    activeRes, 
    overdueRes, 
    dueSoonRes, 
    borrowersRes, 
    totalLentRes, 
    totalCollectedRes, 
    todaysCollectedRes, 
    dueTodayRes,
    allActiveLoans,
  ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(loansTable)
        .where(inArray(loansTable.status, ["active", "extended"])),
      db
        .select({ count: sql<number>`count(*)` })
        .from(loansTable)
        .where(eq(loansTable.status, "overdue")),
      db
        .select({ count: sql<number>`count(*)` })
        .from(loansTable)
        .where(
          and(
            inArray(loansTable.status, ["active", "extended"]),
            sql`${loansTable.dueDate} >= ${formattedToday} AND ${loansTable.dueDate} <= ${formattedSevenDays}`
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(borrowersTable),
      db
        .select({ sum: sql<string>`sum(principal)` })
        .from(loansTable),
      db
        .select({ sum: sql<string>`sum(amount)` })
        .from(paymentsTable),
      db
        .select({ sum: sql<string>`sum(amount)` })
        .from(paymentsTable)
        .where(eq(paymentsTable.paymentDate, formattedToday)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(loansTable)
        .where(
          and(
            inArray(loansTable.status, ["active", "extended"]),
            eq(loansTable.dueDate, formattedToday)
          )
        ),
      // Previously ran AFTER the Promise.all — now batched concurrently
      db
        .select()
        .from(loansTable)
        .where(inArray(loansTable.status, ["active", "overdue", "extended"])),
    ]);

    const outstandingBalancesMap = await this.getOutstandingBalancesForLoans(allActiveLoans);
    let totalOutstanding = 0;
    for (const loan of allActiveLoans) {
      totalOutstanding += outstandingBalancesMap.get(loan.loanId) || 0;
    }

    return {
      activeCount: Number(activeRes[0]?.count || 0),
      totalOutstanding,
      overdueCount: Number(overdueRes[0]?.count || 0),
      dueSoonCount: Number(dueSoonRes[0]?.count || 0),
      borrowersCount: Number(borrowersRes[0]?.count || 0),
      totalAmountLent: Number(totalLentRes[0]?.sum || 0),
      totalAmountCollected: Number(totalCollectedRes[0]?.sum || 0),
      todaysCollections: Number(todaysCollectedRes[0]?.sum || 0),
      dueTodayCount: Number(dueTodayRes[0]?.count || 0),
    };
  }

  async findAllManagement(): Promise<LoanWithBorrower[]> {
    const rawLoans = await db
      .select({
        loan: loansTable,
        borrower: borrowersTable,
      })
      .from(loansTable)
      .leftJoin(borrowersTable, eq(loansTable.borrowerId, borrowersTable.borrowerId))
      .orderBy(desc(loansTable.createdAt));

    const loansOnly = rawLoans.map(item => item.loan);
    const outstandingBalancesMap = await this.getOutstandingBalancesForLoans(loansOnly);

    const data: LoanWithBorrower[] = [];
    for (const item of rawLoans) {
      if (item.borrower) {
        const outstandingBalance = outstandingBalancesMap.get(item.loan.loanId) || 0;
        const monthlyInterestAmount = calculateMonthlyInterest(
          Number(item.loan.principal),
          Number(item.loan.interestRate)
        );
        data.push({
          ...item.loan,
          borrower: item.borrower,
          outstandingBalance,
          monthlyInterestAmount,
        });
      }
    }
    return data;
  }

  async deleteById(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Delete payments associated with this loan
      await tx
        .delete(paymentsTable)
        .where(eq(paymentsTable.loanId, id));

      // 2. Delete notification/reminder logs associated with this loan
      await tx
        .delete(notificationsLogTable)
        .where(eq(notificationsLogTable.loanId, id));

      // 3. Untie references in audit log
      await tx
        .update(auditLogTable)
        .set({ loanId: null })
        .where(eq(auditLogTable.loanId, id));

      // 4. Set loanId to null on loan applications referencing this loan
      await tx
        .update(loanApplicationsTable)
        .set({ loanId: null })
        .where(eq(loanApplicationsTable.loanId, id));

      // 5. Finally delete the loan record
      await tx
        .delete(loansTable)
        .where(eq(loansTable.loanId, id));
    });
  }
}

export const loanRepository = new LoanRepository();
