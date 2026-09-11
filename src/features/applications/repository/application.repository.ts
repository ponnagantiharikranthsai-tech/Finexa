import { db } from "@/db/client";
import { loanApplicationsTable, borrowersTable, type LoanApplication, type InsertLoanApplication } from "@/db/schema";
import { eq, or, like, sql, and, desc } from "drizzle-orm";
import { PaginatedResult } from "@/types/api.types";

import { type Borrower } from "@/db/schema";

export type ApplicationWithBorrower = LoanApplication & {
  borrower: Borrower | null;
};

let isTableStructureEnsured = false;

export async function ensureLoanApplicationsTableStructure(): Promise<void> {
  if (isTableStructureEnsured) return;
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS loan_applications (
        application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_code TEXT UNIQUE,
        principal NUMERIC(12, 2) NOT NULL DEFAULT 0,
        interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        due_date DATE NOT NULL DEFAULT CURRENT_DATE,
        loan_duration TEXT NOT NULL DEFAULT '',
        notes TEXT,
        customer_name TEXT,
        customer_mobile TEXT,
        customer_father_name TEXT,
        customer_father_mobile TEXT,
        customer_email TEXT,
        customer_address TEXT,
        customer_aadhaar_encrypted TEXT,
        customer_pan_encrypted TEXT,
        expiry_date TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'active',
        borrower_id UUID,
        loan_id UUID,
        pdf_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,

      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS application_code TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS principal NUMERIC(12, 2);`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(12, 2);`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS start_date DATE;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS due_date DATE;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS loan_duration TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS notes TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS customer_name TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS customer_mobile TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS customer_father_name TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS customer_father_mobile TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS customer_email TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS customer_address TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS customer_aadhaar_encrypted TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS customer_pan_encrypted TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS borrower_id UUID;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS loan_id UUID;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS pdf_url TEXT;`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();`,
      `ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();`,

      `CREATE INDEX IF NOT EXISTS idx_loan_applications_code ON loan_applications(application_code);`,
      `CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications(status);`,
      `CREATE INDEX IF NOT EXISTS idx_loan_applications_borrower_id ON loan_applications(borrower_id);`,
      `CREATE INDEX IF NOT EXISTS idx_loan_applications_loan_id ON loan_applications(loan_id);`,
      `ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;`
    ];

    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (e) {}
    }

    // Safely ensure interest_type exists
    try {
      await db.execute(sql.raw(`ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS interest_type interest_type;`));
    } catch (e) {
      try {
        await db.execute(sql.raw(`ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS interest_type TEXT DEFAULT 'monthly';`));
      } catch (e2) {}
    }

    isTableStructureEnsured = true;
  } catch (err: any) {
    // Non-blocking schema verification notice
  }
}

export class ApplicationRepository {
  async create(data: InsertLoanApplication): Promise<LoanApplication> {
    await ensureLoanApplicationsTableStructure();
    const [inserted] = await db.insert(loanApplicationsTable).values(data).returning();
    if (!inserted) {
      throw new Error("Failed to insert loan application");
    }
    return inserted;
  }

  async findById(id: string): Promise<LoanApplication | null> {
    await ensureLoanApplicationsTableStructure();
    const [app] = await db
      .select()
      .from(loanApplicationsTable)
      .where(eq(loanApplicationsTable.applicationId, id))
      .limit(1);
    return app || null;
  }

  async findByCode(code: string): Promise<LoanApplication | null> {
    await ensureLoanApplicationsTableStructure();
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
    await ensureLoanApplicationsTableStructure();
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
