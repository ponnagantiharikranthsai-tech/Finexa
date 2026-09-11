export interface LoanApprovalMessageData {
  fullName: string;
  principal: number | string;
  termStartDate: string;
  termEndDate: string;
}

export function formatLoanApprovalMessage(applicationData: LoanApprovalMessageData): string {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  const name = applicationData.fullName || "Customer";
  const amount = Number(applicationData.principal || 0).toLocaleString("en-IN");
  const startDate = formatDate(applicationData.termStartDate);
  const dueDate = formatDate(applicationData.termEndDate);

  return `Dear ${name},

🎉 Congratulations! Your borrower profile and submitted details have been successfully verified. Your loan request has been officially sanctioned.

📋 Loan Sanction Summary:

• Sanctioned Amount: ₹${amount}
• Commencement Date: ${startDate}
• Repayment Due Date: 🗓️ ${dueDate}
• Verification Status: Complete & Verified ✅

Welcome to the FINEXA community! We are committed to providing you with a seamless and transparent financial experience. Please maintain timely repayments to ensure uninterrupted service and higher credit eligibility.

Thank you for choosing FINEXA! 🤝`;
}
