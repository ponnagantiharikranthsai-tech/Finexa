import { db } from "@/db/client";
import { borrowersTable, type Borrower, type InsertBorrower } from "@/db/schema";
import { eq, or, like, sql } from "drizzle-orm";
import { PaginatedResult } from "@/types/api.types";

export type BorrowerFilters = {
  search?: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
};

export class BorrowerRepository {
  async create(data: InsertBorrower): Promise<Borrower> {
    const [inserted] = await db.insert(borrowersTable).values(data).returning();
    if (!inserted) {
      throw new Error("Failed to insert borrower");
    }
    return inserted;
  }

  async findById(id: string): Promise<Borrower | null> {
    const [borrower] = await db
      .select()
      .from(borrowersTable)
      .where(eq(borrowersTable.borrowerId, id))
      .limit(1);
    return borrower || null;
  }

  async findByMobile(mobile: string): Promise<Borrower | null> {
    const [borrower] = await db
      .select()
      .from(borrowersTable)
      .where(eq(borrowersTable.mobile, mobile))
      .limit(1);
    return borrower || null;
  }

  async findByPan(encryptedPan: string): Promise<Borrower | null> {
    const [borrower] = await db
      .select()
      .from(borrowersTable)
      .where(eq(borrowersTable.panEncrypted, encryptedPan))
      .limit(1);
    return borrower || null;
  }

  async findMany(
    filters: BorrowerFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<Borrower>> {
    const { search } = filters;
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = undefined;
    if (search) {
      whereClause = or(
        like(borrowersTable.name, `%${search}%`),
        like(borrowersTable.mobile, `%${search}%`)
      );
    }

    const [data, [{ count }]] = await Promise.all([
      db
        .select()
        .from(borrowersTable)
        .where(whereClause)
        .limit(pageSize)
        .offset(offset)
        .orderBy(borrowersTable.name),
      db
        .select({ count: sql<number>`count(*)` })
        .from(borrowersTable)
        .where(whereClause),
    ]);

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

  async findAll(): Promise<Borrower[]> {
    return db.select().from(borrowersTable);
  }

  async update(id: string, data: Partial<InsertBorrower>): Promise<void> {
    await db
      .update(borrowersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(borrowersTable.borrowerId, id));
  }
}

export const borrowerRepository = new BorrowerRepository();
