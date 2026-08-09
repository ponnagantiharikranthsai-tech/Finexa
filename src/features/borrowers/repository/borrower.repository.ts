import { db } from "@/db/client";
import { borrowersTable, loansTable, paymentsTable, loanApplicationsTable, notificationsLogTable, auditLogTable, type Borrower, type InsertBorrower } from "@/db/schema";
import { eq, or, like, sql, inArray } from "drizzle-orm";
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

  async findMatchingBorrower(inputName: string, inputMobile: string): Promise<Borrower | null> {
    const cleanMobile = inputMobile.trim();
    const cleanName = inputName.trim().toLowerCase();

    const allBorrowers = await db.select().from(borrowersTable);
    const matchingMobileBorrowers = allBorrowers.filter(b => b.mobile.trim() === cleanMobile);

    if (matchingMobileBorrowers.length === 0) return null;

    const exactNameMatch = matchingMobileBorrowers.find(b => b.name.trim().toLowerCase() === cleanName);
    return exactNameMatch || null;
  }

  async getUniqueMobileNumber(baseMobile: string): Promise<string> {
    const cleanMobile = baseMobile.trim();
    const allBorrowers = await db.select().from(borrowersTable);
    const existingMobiles = new Set(allBorrowers.map(b => b.mobile));

    if (!existingMobiles.has(cleanMobile)) {
      return cleanMobile;
    }

    let count = 1;
    while (true) {
      const candidate = cleanMobile + " ".repeat(count);
      if (!existingMobiles.has(candidate)) {
        return candidate;
      }
      count++;
    }
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

  async deleteById(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Find all loans for the borrower
      const loans = await tx
        .select()
        .from(loansTable)
        .where(eq(loansTable.borrowerId, id));
      const loanIds = loans.map((l) => l.loanId);

      if (loanIds.length > 0) {
        // Step 1: Delete all repayment records related to the borrower's loans
        await tx
          .delete(paymentsTable)
          .where(inArray(paymentsTable.loanId, loanIds));

        // Step 2 & 3: Delete all reminders and notification logs related to the borrower's loans
        await tx
          .delete(notificationsLogTable)
          .where(inArray(notificationsLogTable.loanId, loanIds));

        // Untie audit log records
        await tx
          .update(auditLogTable)
          .set({ loanId: null })
          .where(inArray(auditLogTable.loanId, loanIds));
      }

      // Step 4: Delete all internal notes (explicitly nulling out before deleting parent row)
      await tx
        .update(borrowersTable)
        .set({ internalNotes: null, internalNotesUpdatedAt: null })
        .where(eq(borrowersTable.borrowerId, id));

      // Step 5: Delete all applications associated with this borrower or their loans
      if (loanIds.length > 0) {
        await tx
          .delete(loanApplicationsTable)
          .where(
            or(
              eq(loanApplicationsTable.borrowerId, id),
              inArray(loanApplicationsTable.loanId, loanIds)
            )
          );
      } else {
        await tx
          .delete(loanApplicationsTable)
          .where(eq(loanApplicationsTable.borrowerId, id));
      }

      // Step 6: Delete all loan records linked to this borrower
      await tx
        .delete(loansTable)
        .where(eq(loansTable.borrowerId, id));

      // Step 7: Finally delete the borrower record itself
      await tx
        .delete(borrowersTable)
        .where(eq(borrowersTable.borrowerId, id));
    });
  }
}

export const borrowerRepository = new BorrowerRepository();
