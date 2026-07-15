import { getLoansAction } from "@/features/loans/actions/get-loans.action";
import { LoansList } from "@/features/loans/components/loans-list";
import { CreditCard } from "lucide-react";

export const revalidate = 0;

export default async function LoansPage() {
  const res = await getLoansAction({});

  const loans = res.success ? res.data.data : [];
  const total = res.success ? res.data.pagination.total : 0;
  const totalPages = res.success ? res.data.pagination.totalPages : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loans</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track all loan issuances, repayments, and reminder states.
          </p>
        </div>
      </div>


      <LoansList initialLoans={loans} total={total} totalPages={totalPages} />
    </div>
  );
}
