import { db } from "@/db/client";
import { loanCyclesTable, type LoanCycle, type InsertLoanCycle } from "@/db/schema/loan-cycles";
import { eq, desc, sql } from "drizzle-orm";

let isTableInitialized = false;

async function ensureTableExists() {
  if (isTableInitialized) return;
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cycle_status AS ENUM ('active', 'paid', 'overdue_closed', 'extended');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS loan_cycles (
        cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id UUID NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
        cycle_number INTEGER NOT NULL DEFAULT 1,
        start_date DATE NOT NULL,
        original_due_date DATE NOT NULL,
        actual_payment_date DATE,
        principal_amount NUMERIC(12, 2) NOT NULL,
        interest_amount NUMERIC(12, 2) NOT NULL,
        interest_paid NUMERIC(12, 2) DEFAULT '0',
        penalty_amount NUMERIC(12, 2) DEFAULT '0',
        penalty_paid NUMERIC(12, 2) DEFAULT '0',
        total_paid NUMERIC(12, 2) DEFAULT '0',
        remaining_principal NUMERIC(12, 2) NOT NULL,
        cycle_status cycle_status NOT NULL DEFAULT 'active',
        payment_type TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_loan_cycles_loan_id ON loan_cycles(loan_id);
      CREATE INDEX IF NOT EXISTS idx_loan_cycles_status ON loan_cycles(cycle_status);
    `);
    isTableInitialized = true;
  } catch (err) {
    console.error("Failed to ensure loan_cycles table exists:", err);
  }
}

export class LoanCycleRepository {
  async create(data: InsertLoanCycle): Promise<LoanCycle | null> {
    await ensureTableExists();
    try {
      const [inserted] = await db.insert(loanCyclesTable).values(data).returning();
      return inserted || null;
    } catch (e: any) {
      console.error("LoanCycle insert failed:", e.message);
      return null;
    }
  }

  async findByLoanId(loanId: string): Promise<LoanCycle[]> {
    await ensureTableExists();
    try {
      return await db
        .select()
        .from(loanCyclesTable)
        .where(eq(loanCyclesTable.loanId, loanId))
        .orderBy(desc(loanCyclesTable.cycleNumber), desc(loanCyclesTable.createdAt));
    } catch (e: any) {
      return [];
    }
  }

  async getLatestCycle(loanId: string): Promise<LoanCycle | null> {
    await ensureTableExists();
    try {
      const [latest] = await db
        .select()
        .from(loanCyclesTable)
        .where(eq(loanCyclesTable.loanId, loanId))
        .orderBy(desc(loanCyclesTable.cycleNumber), desc(loanCyclesTable.createdAt))
        .limit(1);
      return latest || null;
    } catch (e: any) {
      return null;
    }
  }
}

export const loanCycleRepository = new LoanCycleRepository();
