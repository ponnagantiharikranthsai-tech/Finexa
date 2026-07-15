import { notFound, redirect } from "next/navigation";
import { getLoanByIdAction } from "@/features/loans/actions/get-loan-by-id.action";
import { paymentRepository } from "@/features/payments/repository/payment.repository";
import { notificationLogRepository } from "@/features/notifications/repository/notification-log.repository";
import { LoanDetailView } from "@/features/loans/components/loan-detail-view";
import { CreditCard } from "lucide-react";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LoanDetailPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getLoanByIdAction(id);

  if (!res.success || !res.data) {
    redirect("/loans");
  }

  const loan = res.data;

  const payments = await paymentRepository.findByLoanId(id);
  const notifs = await notificationLogRepository.findByLoanId(id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loan Verification File</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Legal identity audit trail, payment history logs, and reminder dispatch tracking.
          </p>
        </div>
      </div>

      <LoanDetailView
        initialLoan={loan}
        initialPayments={payments}
        initialNotifs={notifs}
      />
    </div>
  );
}
