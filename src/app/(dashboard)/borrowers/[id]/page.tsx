import { redirect } from "next/navigation";
import { getBorrowerByIdAction } from "@/features/borrowers/actions/get-borrower-by-id.action";
import { db } from "@/db/client";
import { loansTable, paymentsTable } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { BorrowerDetailView } from "@/features/borrowers/components/borrower-detail-view";
import { calculatePeriods, calculateMonthlyInterest, calculateOutstandingBalance } from "@/domain/interest-calculator";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BorrowerDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Run borrower fetch + loans fetch in parallel (was sequential)
  const [res, loans] = await Promise.all([
    getBorrowerByIdAction(id),
    db.select().from(loansTable).where(eq(loansTable.borrowerId, id)),
  ]);

  if (!res.success || !res.data) {
    redirect("/borrowers");
  }

  const borrower = res.data;

  // FIX: Single batched payment query instead of N queries in a loop
  const loanIds = loans.map((l) => l.loanId);
  const paymentSums = loanIds.length > 0
    ? await db
        .select({ loanId: paymentsTable.loanId, sum: sql<number>`sum(amount)` })
        .from(paymentsTable)
        .where(inArray(paymentsTable.loanId, loanIds))
        .groupBy(paymentsTable.loanId)
    : [];

  const paymentMap = new Map<string, number>();
  for (const p of paymentSums) {
    paymentMap.set(p.loanId, Number(p.sum || 0));
  }

  // All calculations now done in JS with the already-fetched data
  let totalBorrowed = 0;
  let totalRepaid = 0;
  let outstandingBalance = 0;

  for (const loan of loans) {
    totalBorrowed += Number(loan.principal);
    const totalPayments = paymentMap.get(loan.loanId) || 0;
    totalRepaid += totalPayments;

    const periods = calculatePeriods(loan.dateGiven, loan.dueDate);
    const monthlyInterest = calculateMonthlyInterest(Number(loan.principal), Number(loan.interestRate));
    const totalInterest = periods * monthlyInterest;

    outstandingBalance += calculateOutstandingBalance(
      Number(loan.principal),
      totalInterest,
      Number(loan.penaltyAmount || 0),
      totalPayments
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Borrower Profile</h1>
        <p className="text-sm text-muted-foreground">
          Personal identification, lifetime payment ledger, and legal audit trail.
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

