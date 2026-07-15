import { db } from "@/db/client";
import { loanApplicationsTable, borrowersTable, type LoanApplication, type InsertLoanApplication } from "@/db/schema";
import { eq, or, like, sql, and, desc } from "drizzle-orm";
import { PaginatedResult } from "@/types/api.types";

import { type Borrower } from "@/db/schema";

export type ApplicationWithBorrower = LoanApplication & {
  borrower: Borrower | null;
};

export class ApplicationRepository {
  async create(data: InsertLoanApplication): Promise<LoanApplication> {
    const [inserted] = await db.insert(loanApplicationsTable).values(data).returning();
    if (!inserted) {
      throw new Error("Failed to insert loan application");
    }
    return inserted;
  }

  async findById(id: string): Promise<LoanApplication | null> {
    const [app] = await db
      .select()
      .from(loanApplicationsTable)
      .where(eq(loanApplicationsTable.applicationId, id))
      .limit(1);
    return app || null;
  }

  async findByCode(code: string): Promise<LoanApplication | null> {
    const [app] = await db
      .select()
      .from(loanApplicationsTable)
      .where(eq(loanApplicationsTable.applicationCode, code))
      .limit(1);
    return app || null;
  }

  async findMany(
    filters: { search?: string; status?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<PaginatedResult<ApplicationWithBorrower>> {
    const { search, status } = filters;
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let conditions = [];
    if (status && status !== "all") {
      conditions.push(eq(loanApplicationsTable.status, status));
    }
    if (search) {
      conditions.push(
        or(
          like(loanApplicationsTable.applicationCode, `%${search}%`),
          like(borrowersTable.name, `%${search}%`),
          like(borrowersTable.mobile, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rawApps, [{ count }]] = await Promise.all([
      db
        .select({
          application: loanApplicationsTable,
          borrower: borrowersTable,
        })
        .from(loanApplicationsTable)
        .leftJoin(borrowersTable, eq(loanApplicationsTable.borrowerId, borrowersTable.borrowerId))
        .where(whereClause)
        .limit(pageSize)
        .offset(offset)
        .orderBy(desc(loanApplicationsTable.createdAt)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(loanApplicationsTable)
        .leftJoin(borrowersTable, eq(loanApplicationsTable.borrowerId, borrowersTable.borrowerId))
        .where(whereClause),
    ]);

    const data: ApplicationWithBorrower[] = rawApps.map((item) => ({
      ...item.application,
      borrower: item.borrower,
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

  async update(id: string, data: Partial<InsertLoanApplication>): Promise<void> {
    await db
      .update(loanApplicationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(loanApplicationsTable.applicationId, id));
  }
}

export const applicationRepository = new ApplicationRepository();
