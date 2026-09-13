export interface LoanApprovalMessageData {
  fullName: string;
  phoneNumber?: string;
  principal: number | string;
  interestRate?: number | string;
  monthlyInterest?: number | string;
  termStartDate: string;
  termEndDate: string;
}

export function formatLoanApprovalMessage(data: LoanApprovalMessageData): string {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0]! : dateStr;
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    return cleanDate;
  };

  const name = data.fullName || "Borrower";
  const phone = data.phoneNumber || "N/A";
  const principal = Number(data.principal || 0).toLocaleString("en-IN");
  const rate = data.interestRate !== undefined && data.interestRate !== null && data.interestRate !== ""
    ? data.interestRate
    : "20";
  const monthlyInt = Number(data.monthlyInterest || 0).toLocaleString("en-IN");
  const dateGiven = formatDate(data.termStartDate);
  const dueDate = formatDate(data.termEndDate);

  return `🎉 *Congratulations ${name}!*

Your identity and profile verification have been *successfully approved* ✅. 
Your loan account has now been created on *Finexa*.

📋 *Loan Summary:*
• *Borrower Name:* ${name}
• *Phone Number:* ${phone}
• *Principal Amount:* ₹${principal}
• *Interest Rate:* ₹${rate} per ₹1,000 / month
• *Monthly Interest:* ₹${monthlyInt}
• *Date Issued:* ${dateGiven}
• *First Due Date:* ${dueDate}

Thanks for contacting Finexa! 🙏

Reply *HELP* if you have any questions.
— *Team Finexa*`;
}
