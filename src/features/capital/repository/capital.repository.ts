import { db } from "@/db/client";
import { fundersTable, capitalReturnsTable } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export class CapitalRepository {
  async createFunder(data: typeof fundersTable.$inferInsert) {
    const [inserted] = await db.insert(fundersTable).values(data).returning();
    if (!inserted) {
      throw new Error("Failed to insert funder");
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
    const [funder] = await db
      .select()
      .from(fundersTable)
      .where(eq(fundersTable.mobile, mobile))
      .limit(1);
    return funder || null;
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
}

export const capitalRepository = new CapitalRepository();
