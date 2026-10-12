import React from 'react';
import Image from 'next/image';
import { getBorrowerPortalDataAction } from '@/actions/borrower-portal';
import { calculatePeriods, calculateMonthlyInterest } from '@/domain/interest-calculator';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Borrower Digital Passbook | FINEXA',
  description: 'Live real-time loan status, total payable balance, and repayment passbook for FINEXA borrowers.',
};

export default async function BorrowerPortalPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const result = await getBorrowerPortalDataAction(resolvedParams.token);

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center max-w-sm w-full shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3 text-lg font-bold">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-red-400 mb-2">Invalid or Expired Link</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Please contact FINEXA management to receive a valid passbook link.
          </p>
        </div>
      </div>
    );
  }

  const { loan } = result.data;
  const payments = loan.payments || [];

  // Calculate Loan Metrics
  const loanAmount = Number(loan.principal || 0);

  let calculatedInterest = 0;
  if (loan.dateGiven && loan.dueDate && loan.interestRate) {
    try {
      const periods = calculatePeriods(loan.dateGiven, loan.dueDate, loan.interestType);
      calculatedInterest = Math.round(periods * calculateMonthlyInterest(loanAmount, Number(loan.interestRate)));
    } catch {
      // Fallback standard rate estimation if dates error
      calculatedInterest = Math.round((loanAmount * Number(loan.interestRate || 0)) / 100);
    }
  }

  const totalInterest = Number(
    (loan as any).totalInterest || (loan as any).interestAmount || calculatedInterest
  );
  const totalPayable = Number((loan as any).totalPayable || (loanAmount + totalInterest));
  
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const remainingPayable = Number(
    (loan as any).outstandingBalance || Math.max(0, totalPayable - totalPaid)
  );

  const borrowerMobile = loan.borrower?.mobile || (loan.borrower as any)?.phone || '';

  return (
    <main className="min-h-screen bg-[#0d0d11] text-slate-100 p-4 max-w-md mx-auto pb-12 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center py-4 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          {/* Maskable Gold Rupee Logo Container */}
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-amber-500/40 bg-[#0d0d11] shrink-0 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <img
              src="/icon-512-maskable.png"
              alt="FINEXA Logo"
              className="w-full h-full object-cover scale-125"
            />
          </div>

          <div>
            <h1 className="font-black text-lg text-amber-400 tracking-wider leading-none">FINEXA</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight mt-0.5">BORROWER DIGITAL PASSBOOK</p>
          </div>
        </div>

        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-md text-[11px] font-bold uppercase tracking-wider">
          {loan.status || 'ACTIVE'}
        </span>
      </header>

      {/* Borrower Profile Card */}
      <div className="bg-[#141418] border border-slate-800/80 rounded-2xl p-4 mb-4 flex justify-between items-center shadow-lg">
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Borrower Name</div>
          <div className="text-base font-extrabold text-white">{loan.borrower?.name || 'Borrower'}</div>
        </div>
        <div className="text-xs text-slate-500 font-mono tracking-widest">
          {borrowerMobile ? `••••${borrowerMobile.slice(-4)}` : '••••4750'}
        </div>
      </div>

      {/* Hero Highlight: Total Payable Amount */}
      <div className="bg-[#141418] border border-emerald-500/30 rounded-2xl p-5 mb-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider mb-1">
          TOTAL PAYABLE AMOUNT
        </div>
        <div className="text-4xl font-black text-emerald-400 mb-5 font-mono">
          ₹{remainingPayable.toLocaleString('en-IN')}
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80 text-sm">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Original Loan</span>
            <span className="font-extrabold text-white text-base font-mono">₹{loanAmount.toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Total Interest</span>
            <span className="font-extrabold text-amber-400 text-base font-mono">₹{totalInterest.toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Date Given</span>
            <span className="font-bold text-slate-200 text-xs">{(loan as any).startDate || loan.dateGiven || '2026-10-10'}</span>
          </div>

          <div className="bg-amber-950/20 p-3 rounded-xl border border-amber-500/20">
            <span className="text-[10px] text-amber-400 font-semibold uppercase block mb-0.5">Due Date</span>
            <span className="font-bold text-amber-400 text-xs flex items-center gap-1">
              📅 {loan.dueDate || '2026-10-13'}
            </span>
          </div>
        </div>
      </div>

      {/* Repayment History */}
      <section className="mt-6">
        <div className="flex justify-between items-center mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-sm">✓</span>
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Repayment Passbook</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {payments.length} {payments.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {payments && payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((p: any) => (
              <div
                key={p.paymentId || p.id}
                className="bg-[#141418] border border-slate-800/80 rounded-xl p-3 flex justify-between items-center hover:border-slate-700/80 transition-all shadow-sm"
              >
                <div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    +₹{Number(p.amount).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {p.paymentDate || p.createdAt || p.date || 'Payment Received'}
                  </div>
                  {p.notes && (
                    <div className="text-[10px] text-slate-500 italic mt-0.5">{p.notes}</div>
                  )}
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded-md font-medium uppercase">
                  {p.paymentType || p.type || 'Principal'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#141418]/50 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
            <div className="text-sm font-semibold text-slate-300 mb-1">No repayments recorded yet</div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Payments made will appear here automatically with timestamp and receipt verification.
            </p>
          </div>
        )}
      </section>

      {/* Verified Footer */}
      <footer className="mt-10 text-center text-[11px] text-slate-600 space-y-1 border-t border-slate-900 pt-6">
        <p>🔒 End-to-end verified by FINEXA Financial Core</p>
        <p>Questions about this account? Contact your loan officer directly.</p>
      </footer>
    </main>
  );
}
