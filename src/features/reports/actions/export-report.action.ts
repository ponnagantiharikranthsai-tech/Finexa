"use server";

import { reportRepository } from "../repository/report.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

function convertToCSV(headers: string[], rows: any[][]): string {
  const headerLine = headers.join(",");
  const rowLines = rows.map((row) =>
    row
      .map((val) => {
        const cleaned = typeof val === "string" ? val.replace(/"/g, '""') : String(val);
        return `"${cleaned}"`;
      })
      .join(",")
  );
  return [headerLine, ...rowLines].join("\n");
}

export async function exportReportAction(
  reportType: "overdue" | "outstanding" | "interest_earned" | "closed_history",
  dateFrom?: string,
  dateTo?: string
): Promise<ActionResult<{ csvContent: string; filename: string }>> {
  try {
    await requireAuth();

    let csvContent = "";
    const dateStr = new Date().toISOString().split("T")[0]!;
    const filename = `finexa-${reportType}-${dateStr}.csv`;

    if (reportType === "overdue") {
      const res = await reportRepository.getOverdueLoans(1, 10000);
      const headers = ["Borrower Name", "Mobile", "Principal (INR)", "Due Date", "Days Overdue", "Outstanding Balance (INR)"];
      const rows = res.data.map((r) => [
        r.borrowerName,
        r.mobile,
        r.principal,
        r.dueDate,
        r.daysOverdue,
        r.outstandingBalance,
      ]);
      csvContent = convertToCSV(headers, rows);
    } else if (reportType === "outstanding") {
      const res = await reportRepository.getOutstandingBalances(1, 10000);
      const headers = ["Borrower Name", "Mobile", "Email", "Active Loans Count", "Total Outstanding (INR)", "Largest Loan (INR)"];
      const rows = res.data.map((r) => [
        r.borrowerName,
        r.mobile,
        r.email,
        r.activeLoansCount,
        r.totalOutstanding,
        r.largestLoan,
      ]);
      csvContent = convertToCSV(headers, rows);
    } else if (reportType === "interest_earned") {
      if (!dateFrom || !dateTo) {
        return { success: false, error: "Date range required" };
      }
      const res = await reportRepository.getInterestEarned(dateFrom, dateTo, 1, 10000);
      const headers = ["Payment Date", "Borrower Name", "Loan ID", "Loan Principal", "Interest Amount (INR)", "Notes"];
      const rows = res.data.map((r) => [
        r.paymentDate,
        r.borrowerName,
        r.loanId,
        r.principal,
        r.amount,
        r.notes || "",
      ]);
      csvContent = convertToCSV(headers, rows);
    } else if (reportType === "closed_history") {
      if (!dateFrom || !dateTo) {
        return { success: false, error: "Date range required" };
      }
      const res = await reportRepository.getClosedLoans(dateFrom, dateTo, 1, 10000);
      const headers = ["Borrower Name", "Principal (INR)", "Date Given", "Date Closed", "Total Interest Collected (INR)", "Duration (Months)"];
      const rows = res.data.map((r) => [
        r.borrowerName,
        r.principal,
        r.dateGiven,
        r.dateClosed,
        r.totalInterestCollected,
        r.durationMonths,
      ]);
      csvContent = convertToCSV(headers, rows);
    } else {
      return { success: false, error: "Invalid report type" };
    }

    return { success: true, data: { csvContent, filename } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to export report" };
  }
}
