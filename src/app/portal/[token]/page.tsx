import React from "react";
import { getBorrowerPortalDataAction } from "@/actions/borrower-portal";
import { CreditCard, Calendar, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Borrower Digital Passbook | FINEXA",
  description: "Live real-time loan status, outstanding balance, and repayment passbook for FINEXA borrowers.",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function BorrowerPortalPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getBorrowerPortalDataAction(token);

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-[#0d0d11] text-zinc-100 flex items-center justify-center p-4">
        <div className="bg-[#141418] border border-zinc-800/80 p-8 rounded-3xl text-center max-w-sm w-full shadow-2xl space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg font-black text-red-400 mb-1">Invalid or Expired Link</h1>
            <p className="text-zinc-400 text-xs leading-relaxed">
              This magic link is either expired or inactive. Please contact FINEXA administration to receive an updated passbook link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { loan } = result.data;
  const payments = loan.payments || [];
  const totalPrincipalRepaid = payments
    .filter((p: any) => p.paymentType === "principal")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  
  const originalPrincipal = Number(loan.principal);
  const remainingPrincipal = Math.max(0, originalPrincipal - totalPrincipalRepaid);

  const statusColor =
    loan.status === "closed"
      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
      : loan.status === "overdue"
      ? "bg-red-500/15 border-red-500/30 text-red-400"
      : "bg-amber-500/15 border-amber-500/30 text-amber-400";

  return (
    <main className="min-h-screen bg-[#0d0d11] text-zinc-100 p-4 sm:p-6 max-w-md mx-auto pb-16 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center py-4 border-b border-zinc-800/80 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-black text-lg text-amber-400 tracking-wider">FINEXA</h1>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">Borrower Digital Passbook</p>
          </div>
        </div>
        <span className={`px-3 py-1 border rounded-full text-[11px] font-bold uppercase tracking-wider ${statusColor}`}>
          {loan.status}
        </span>
      </header>

      {/* Borrower Profile Tag */}
      {loan.borrower?.name && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-[#141418] border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Borrower Name</span>
            <span className="text-sm font-bold text-zinc-200">{loan.borrower.name}</span>
          </div>
          {loan.borrower.mobile && (
            <span className="text-xs font-mono text-zinc-400 font-medium">
              ••••••{loan.borrower.mobile.slice(-4)}
            </span>
          )}
        </div>
      )}

      {/* Loan Financial Summary Card */}
      <div className="bg-[#141418] border border-zinc-800/90 rounded-3xl p-6 mb-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-amber-400" /> Current Principal Balance
        </div>
        <div className="text-3xl sm:text-4xl font-black font-mono text-amber-400 mb-5">
          ₹{remainingPrincipal.toLocaleString("en-IN")}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-0.5">Original Loan</span>
            <span className="font-mono font-bold text-zinc-200 text-sm">₹{originalPrincipal.toLocaleString("en-IN")}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-0.5">Payment Frequency</span>
            <span className="font-semibold text-zinc-200 capitalize text-sm">{loan.interestType}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-0.5">Date Given</span>
            <span className="font-medium text-zinc-300">{loan.dateGiven || "—"}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-0.5">Due Date</span>
            <span className="font-bold text-amber-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {loan.dueDate || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Repayment History Passbook */}
      <section className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Repayment Passbook
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {payments.length} {payments.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {payments.length > 0 ? (
          payments.map((p: any) => (
            <div
              key={p.paymentId || p.id}
              className="bg-[#141418] border border-zinc-800/80 rounded-2xl p-4 flex justify-between items-center hover:border-zinc-700/80 transition-all shadow-sm"
            >
              <div className="space-y-0.5">
                <div className="text-sm font-bold font-mono text-emerald-400">
                  +₹{Number(p.amount).toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {p.paymentDate || "Payment Received"}
                </div>
                {p.notes && (
                  <div className="text-[10px] text-zinc-400 italic">
                    {p.notes}
                  </div>
                )}
              </div>
              <span className="text-[11px] bg-zinc-900/90 text-zinc-300 border border-zinc-800 px-3 py-1 rounded-full capitalize font-semibold">
                {p.paymentType || "Principal"}
              </span>
            </div>
          ))
        ) : (
          <div className="bg-[#141418]/60 border border-dashed border-zinc-800/80 rounded-2xl p-8 text-center text-zinc-500 text-xs space-y-1">
            <p className="font-semibold text-zinc-400">No repayments recorded yet</p>
            <p className="text-[11px]">Payments made will appear here automatically with timestamp and receipt verification.</p>
          </div>
        )}
      </section>

      {/* Footer Info */}
      <footer className="mt-12 text-center text-[11px] text-zinc-600 space-y-1 border-t border-zinc-900 pt-6">
        <p>🔒 End-to-end verified by FINEXA Financial Core</p>
        <p>Questions about this account? Contact your loan officer directly.</p>
      </footer>
    </main>
  );
}
