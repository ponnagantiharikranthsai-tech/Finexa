import { db } from "@/db/client";
import { paymentsTable, loansTable, type Payment, type InsertPayment } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { calculatePeriods, calculateMonthlyInterest, calculateOutstandingBalance } from "@/domain/interest-calculator";

export class PaymentRepository {
  async create(data: InsertPayment): Promise<Payment> {
    const [inserted] = await db.insert(paymentsTable).values(data).returning();
    if (!inserted) {
      throw new Error("Failed to insert payment");
    }
    return inserted;
  }

  async findByLoanId(loanId: string): Promise<Payment[]> {
    return db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.loanId, loanId))
      .orderBy(paymentsTable.paymentDate);
  }

  async deleteById(id: string): Promise<void> {
    await db.delete(paymentsTable).where(eq(paymentsTable.paymentId, id));
  }

  async getOutstandingBalance(loanId: string): Promise<number> {
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.loanId, loanId)).limit(1);
    if (!loan) {
      throw new Error("Loan not found");
    }

    const paymentsResult = await db
      .select({ sum: sql<number>`sum(amount)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.loanId, loanId));

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
}

export const paymentRepository = new PaymentRepository();
