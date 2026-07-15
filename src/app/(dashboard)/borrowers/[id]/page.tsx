import { redirect } from "next/navigation";
import { getBorrowerByIdAction } from "@/features/borrowers/actions/get-borrower-by-id.action";
import { db } from "@/db/client";
import { loansTable, paymentsTable } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { BorrowerDetailView } from "@/features/borrowers/components/borrower-detail-view";
import { calculatePeriods, calculateMonthlyInterest, calculateOutstandingBalance } from "@/domain/interest-calculator";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BorrowerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getBorrowerByIdAction(id);

  if (!res.success || !res.data) {
    redirect("/borrowers");
  }

  const borrower = res.data;

  // Load borrower's loans
  const loans = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.borrowerId, id));

  // Computations
  let totalBorrowed = 0;
  let totalRepaid = 0;
  let outstandingBalance = 0;

  for (const loan of loans) {
    totalBorrowed += Number(loan.principal);

    // Sum payments
    const paymentsRes = await db
      .select({ sum: sql<number>`sum(amount)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.loanId, loan.loanId));

    const totalPayments = Number(paymentsRes[0]?.sum || 0);
    totalRepaid += totalPayments;

    // Sum outstanding balance dynamically using calculator
    const periods = calculatePeriods(loan.dateGiven, loan.dueDate);
    const monthlyInterest = calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate));
    const totalInterest = periods * monthlyInterest;
    
    const outstanding = calculateOutstandingBalance(
      Number(loan.principal),
      totalInterest,
      Number(loan.penaltyAmount || 0),
      totalPayments
    );
    outstandingBalance += outstanding;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Borrower Profile file</h1>
        <p className="text-sm text-muted-foreground">
          Personal identification file, lifetime payment ledger, and legal audit file.
        </p>
      </div>

      <BorrowerDetailView
        borrower={borrower}
        loans={loans}
        totalBorrowed={totalBorrowed}
        totalRepaid={totalRepaid}
        outstandingBalance={outstandingBalance}
      />
    </div>
  );
}
