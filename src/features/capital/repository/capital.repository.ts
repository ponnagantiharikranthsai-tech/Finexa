import { db } from "@/db/client";
import { fundersTable, capitalReturnsTable, capitalAllocationsTable, loansTable } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export class CapitalRepository {
  async createFunder(data: typeof fundersTable.$inferInsert) {
    const [inserted] = await db.insert(fundersTable).values(data).returning();
    if (!inserted) {
      throw new Error("Failed to insert funder investment record");
    }
    return inserted;
  }

  async updateFunder(id: string, data: Partial<typeof fundersTable.$inferInsert>) {
    const [updated] = await db
      .update(fundersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fundersTable.funderId, id))
      .returning();
    return updated || null;
  }

  async deleteFunder(id: string) {
    const [deleted] = await db
      .delete(fundersTable)
      .where(eq(fundersTable.funderId, id))
      .returning();
    return deleted || null;
  }

  async findFunderById(id: string) {
    const [funder] = await db
      .select()
      .from(fundersTable)
      .where(eq(fundersTable.funderId, id))
      .limit(1);
    return funder || null;
  }

  async findFunderByMobile(mobile: string) {
    if (!mobile) return null;
    const cleanSubmitted = mobile.replace(/[^0-9]/g, "").slice(-10);
    if (!cleanSubmitted) return null;

    const allFunders = await this.findAllFunders();
    const found = allFunders.find((f) => {
      const cleanDb = f.mobile.replace(/[^0-9]/g, "").slice(-10);
      return cleanDb === cleanSubmitted;
    });
    return found || null;
  }

  async findFundersByMobileList(mobile: string) {
    if (!mobile) return [];
    const cleanSubmitted = mobile.replace(/[^0-9]/g, "").slice(-10);
    if (!cleanSubmitted) return [];

    const allFunders = await this.findAllFunders();
    return allFunders.filter((f) => {
      const cleanDb = f.mobile.replace(/[^0-9]/g, "").slice(-10);
      return cleanDb === cleanSubmitted;
    });
  }

  async findAllFunders() {
    return await db
      .select()
      .from(fundersTable)
      .orderBy(fundersTable.createdAt);
  }

  async createCapitalReturn(data: typeof capitalReturnsTable.$inferInsert) {
    const [inserted] = await db.insert(capitalReturnsTable).values(data).returning();
    if (!inserted) {
      throw new Error("Failed to insert capital return");
    }
    return inserted;
  }

  async findCapitalReturnsByFunderId(funderId: string) {
    return await db
      .select()
      .from(capitalReturnsTable)
      .where(eq(capitalReturnsTable.funderId, funderId))
      .orderBy(capitalReturnsTable.returnDate);
  }

  async findAllCapitalReturns() {
    return await db
      .select()
      .from(capitalReturnsTable)
      .orderBy(capitalReturnsTable.returnDate);
  }

  // ── Capital Allocations ───────────────────────────────────────────────────

  async createAllocation(data: typeof capitalAllocationsTable.$inferInsert) {
    const [inserted] = await db
      .insert(capitalAllocationsTable)
      .values(data)
      .returning();
    if (!inserted) {
      throw new Error("Failed to insert capital allocation");
    }
    return inserted;
  }

  async updateAllocation(
    id: string,
    data: Partial<typeof capitalAllocationsTable.$inferInsert>
  ) {
    const [updated] = await db
      .update(capitalAllocationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(capitalAllocationsTable.allocationId, id))
      .returning();
    return updated || null;
  }

  async deleteAllocation(id: string) {
    const [deleted] = await db
      .delete(capitalAllocationsTable)
      .where(eq(capitalAllocationsTable.allocationId, id))
      .returning();
    return deleted || null;
  }

  async findAllocationsByLoanId(loanId: string) {
    return await db
      .select({
        allocation: capitalAllocationsTable,
        funder: fundersTable,
      })
      .from(capitalAllocationsTable)
      .innerJoin(fundersTable, eq(capitalAllocationsTable.funderId, fundersTable.funderId))
      .where(eq(capitalAllocationsTable.loanId, loanId))
      .orderBy(capitalAllocationsTable.createdAt);
  }

  async findAllocationsByFunderId(funderId: string) {
    return await db
      .select({
        allocation: capitalAllocationsTable,
        loan: loansTable,
      })
      .from(capitalAllocationsTable)
      .innerJoin(loansTable, eq(capitalAllocationsTable.loanId, loansTable.loanId))
      .where(eq(capitalAllocationsTable.funderId, funderId))
      .orderBy(capitalAllocationsTable.createdAt);
  }

  async findAllAllocations() {
    return await db
      .select()
      .from(capitalAllocationsTable)
      .orderBy(capitalAllocationsTable.createdAt);
  }
}

export const capitalRepository = new CapitalRepository();
