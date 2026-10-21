'use client';

import React, { useState } from 'react';
import { Download, Eye, Loader2 } from 'lucide-react';
import {
  downloadPartialPaymentPdf,
  viewPartialPaymentPdf,
  type PartialPaymentResultPayload,
} from '@/features/loans/utils/generate-partial-payment-pdf';
import {
  downloadPaymentCompletedPdf,
  viewPaymentCompletedPdf,
  type PaymentCompletedResultPayload,
} from '@/features/loans/utils/generate-payment-completed-pdf';
import { toast } from 'sonner';

interface PortalReceiptButtonProps {
  loan: any;
  payment: any;
  allPayments: any[];
}

export function PortalReceiptButton({ loan, payment, allPayments }: PortalReceiptButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);

  const buildPayload = () => {
    // Sort all payments chronologically (oldest first) to compute accurate running totals
    const sorted = [...allPayments].sort((a, b) => {
      const dateA = new Date(a.paymentDate || a.createdAt || a.date).getTime();
      const dateB = new Date(b.paymentDate || b.createdAt || b.date).getTime();
      return dateA - dateB;
    });

    const paymentId = payment.paymentId || payment.id;
    const pIdx = Math.max(0, sorted.findIndex((p) => (p.paymentId || p.id) === paymentId));
    const currentPayment = sorted[pIdx] || payment;

    const principalNum = Number(loan.principal || 0);
    const rateNum = Number(loan.interestRate || 0);
    const monthlyInterestAmount = Number(
      loan.monthlyInterestAmount || Math.round((principalNum * rateNum) / 1000) || 0
    );
    const penaltyNum = Number(loan.penaltyAmount || 0);
    const totalPayable = Number(
      loan.totalPayable || principalNum + monthlyInterestAmount + penaltyNum
    );

    const historyUpToCurrent = sorted.slice(0, pIdx + 1);
    const previousPaidAmount = sorted
      .slice(0, pIdx)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const currentPaymentAmount = Number(currentPayment.amount || 0);
    const totalAmountPaidToDate = previousPaidAmount + currentPaymentAmount;
    const remainingBalance = Math.max(0, totalPayable - totalAmountPaidToDate);
    const isFullyCleared = remainingBalance <= 0;
    const paymentStatus: 'PARTIAL PAYMENT' | 'PAID / COMPLETED' = isFullyCleared
      ? 'PAID / COMPLETED'
      : 'PARTIAL PAYMENT';

    const paymentDateStr =
      currentPayment.paymentDate ||
      currentPayment.createdAt ||
      currentPayment.date ||
      new Date().toISOString().split('T')[0];
    const dateFormatted = paymentDateStr.replace(/-/g, '').slice(0, 8);
    const currentReceiptNo = `RC-${dateFormatted}-${String(pIdx + 1).padStart(3, '0')}`;

    let accumPaid = 0;
    const paymentsHistory = historyUpToCurrent.map((item, idx) => {
      const itemAmt = Number(item.amount || 0);
      accumPaid += itemAmt;
      const itemBal = Math.max(0, totalPayable - accumPaid);
      const itemDate = item.paymentDate || item.createdAt || item.date || '';
      return {
        paymentId: item.paymentId || item.id,
        paymentDate: itemDate,
        date: itemDate,
        receiptNo: `RC-${itemDate.replace(/-/g, '').slice(0, 8)}-${String(idx + 1).padStart(3, '0')}`,
        amount: itemAmt,
        amountPaid: itemAmt,
        totalPaid: accumPaid,
        balance: itemBal,
        paymentType: item.paymentType || item.type || 'Principal',
        notes: item.notes || null,
      };
    });

    return {
      documentId: `FIN-PAY-${dateFormatted}-${pIdx + 1001}`,
      receiptNumber: currentReceiptNo,
      transactionId: paymentId || `TX-${dateFormatted}`,
      paymentDate: paymentDateStr,
      paymentAmount: currentPaymentAmount,
      paymentType: currentPayment.paymentType || currentPayment.type || 'Principal',
      notes: currentPayment.notes || null,

      loanId: loan.loanId,
      borrowerName: loan.borrower?.name || 'Borrower',
      borrowerMobile: loan.borrower?.mobile || (loan.borrower as any)?.phone || '',
      email: loan.borrower?.email || undefined,
      locationUrl: loan.borrower?.locationUrl || undefined,

      dateGiven: loan.dateGiven || (loan as any).startDate,
      dueDate: loan.dueDate,
      principal: principalNum,
      interestRate: rateNum,
      interestType: loan.interestType || 'Monthly',
      monthlyInterestAmount,
      loanType: loan.interestType || 'Monthly',

      principalPaid:
        (currentPayment.paymentType || currentPayment.type) === 'principal'
          ? currentPaymentAmount
          : 0,
      interestPaid:
        (currentPayment.paymentType || currentPayment.type) === 'interest'
          ? currentPaymentAmount
          : 0,
      penaltyPaid:
        (currentPayment.paymentType || currentPayment.type) === 'penalty'
          ? currentPaymentAmount
          : 0,

      previousOutstanding: Math.max(0, totalPayable - previousPaidAmount),
      remainingOutstanding: remainingBalance,
      totalPayableAfterPayment: remainingBalance,
      totalAmountPaidToDate,
      totalPaidTillDate: totalAmountPaidToDate,
      totalInterestAccrued: monthlyInterestAmount,
      totalPenaltyAccrued: penaltyNum,

      totalPayable,
      previousPaidAmount,
      currentPaymentAmount,
      remainingBalance,
      paymentStatus,

      loanStatus: isFullyCleared ? 'CLOSED' : (loan.status || 'ACTIVE').toUpperCase(),
      isFullyCleared,

      paymentsHistory,
    };
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloading(true);
    try {
      const payload = buildPayload();
      if (payload.isFullyCleared) {
        await downloadPaymentCompletedPdf(payload as PaymentCompletedResultPayload);
      } else {
        await downloadPartialPaymentPdf(payload as PartialPaymentResultPayload);
      }
      toast.success('Official payment receipt downloaded!');
    } catch (err: any) {
      console.error('Failed to download receipt:', err);
      toast.error('Unable to generate receipt PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleView = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewing(true);
    try {
      const payload = buildPayload();
      if (payload.isFullyCleared) {
        await viewPaymentCompletedPdf(payload as PaymentCompletedResultPayload);
      } else {
        await viewPartialPaymentPdf(payload as PartialPaymentResultPayload);
      }
    } catch (err: any) {
      console.error('Failed to view receipt:', err);
      toast.error('Unable to open receipt PDF');
    } finally {
      setViewing(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleDownload}
        disabled={downloading || viewing}
        title="Download Official PDF Receipt"
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 border border-emerald-500/30 rounded-lg transition-all active:scale-95 disabled:opacity-50 shadow-sm"
      >
        {downloading ? (
          <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
        ) : (
          <Download className="w-3 h-3 text-emerald-400" />
        )}
        <span>Receipt</span>
      </button>

      <button
        onClick={handleView}
        disabled={downloading || viewing}
        title="View Receipt in New Tab"
        className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-all active:scale-95 disabled:opacity-50"
      >
        {viewing ? (
          <Loader2 className="w-3 h-3 animate-spin text-slate-300" />
        ) : (
          <Eye className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}
