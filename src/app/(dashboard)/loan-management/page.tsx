import { getLoanManagementDataAction } from "@/features/loans/actions/get-loan-management-data.action";
import { LoanManagementList } from "@/features/loans/components/loan-management-list";
import { CreditCard } from "lucide-react";

export const revalidate = 0;

export default async function LoanManagementPage() {
  const res = await getLoanManagementDataAction();
  const loans = res.success ? res.data : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified borrower details, KYC, and loan portfolio management.
          </p>
        </div>
      </div>

      <LoanManagementList initialLoans={loans} />
    </div>
  );
}
