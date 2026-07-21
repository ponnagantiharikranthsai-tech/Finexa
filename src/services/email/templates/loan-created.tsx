import * as React from "react";

interface LoanCreatedEmailProps {
  borrowerName: string;
  principal: number;
  monthlyInterest: number;
  interestRate: number;
  dateGiven: string;
  dueDate: string;
  applicationLink?: string;
}

export const LoanCreatedEmail: React.FC<Readonly<LoanCreatedEmailProps>> = ({
  borrowerName,
  principal,
  monthlyInterest,
  interestRate,
  dateGiven,
  dueDate,
  applicationLink = "https://finexa-tzxa.vercel.app",
}) => {
  return (
    <div style={{
      backgroundColor: "#0b0f19",
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      padding: "40px 20px",
      margin: "0",
      color: "#f3f4f6",
      textAlign: "center"
    }}>
      <div style={{
        maxWidth: "580px",
        margin: "0 auto",
        backgroundColor: "#111827",
        borderRadius: "16px",
        border: "1px solid rgba(212, 175, 55, 0.25)",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)"
      }}>
        {/* Header Branding */}
        <div style={{
          padding: "30px 20px",
          borderBottom: "1px solid rgba(212, 175, 55, 0.15)",
          backgroundColor: "#0d131f"
        }}>
          <h1 style={{
            margin: "0",
            fontSize: "26px",
            fontWeight: "900",
            letterSpacing: "3px",
            color: "#D4AF37"
          }}>
            F I N E X A
          </h1>
          <p style={{
            margin: "5px 0 0",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "#9ca3af"
          }}>
            Smart Loan Management
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: "40px 30px", textAlign: "left" }}>
          <h2 style={{
            fontSize: "20px",
            fontWeight: "bold",
            color: "#ffffff",
            margin: "0 0 20px",
            borderBottom: "1px solid #1f2937",
            paddingBottom: "10px"
          }}>
            Loan File Created
          </h2>
          <p style={{ fontSize: "15px", lineHeight: "1.6", color: "#d1d5db" }}>
            Dear <strong>{borrowerName}</strong>,
          </p>
          <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#d1d5db" }}>
            Your new loan file has been registered. The details of the agreement are listed below for your reference:
          </p>

          {/* Details Table */}
          <div style={{
            margin: "25px 0",
            borderRadius: "12px",
            backgroundColor: "#0d131f",
            border: "1px solid #1f2937",
            overflow: "hidden"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "12px 15px", fontSize: "13px", fontWeight: "bold", color: "#9ca3af", borderBottom: "1px solid #1f2937", width: "45%" }}>Principal Amount</td>
                  <td style={{ padding: "12px 15px", fontSize: "14px", fontWeight: "bold", color: "#ffffff", borderBottom: "1px solid #1f2937", textAlign: "right" }}>₹{principal.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td style={{ padding: "12px 15px", fontSize: "13px", fontWeight: "bold", color: "#9ca3af", borderBottom: "1px solid #1f2937" }}>Interest Rate</td>
                  <td style={{ padding: "12px 15px", fontSize: "13px", color: "#D4AF37", borderBottom: "1px solid #1f2937", textAlign: "right" }}>₹{interestRate} per ₹1,000 / month</td>
                </tr>
                <tr>
                  <td style={{ padding: "12px 15px", fontSize: "13px", fontWeight: "bold", color: "#9ca3af", borderBottom: "1px solid #1f2937" }}>Monthly Interest</td>
                  <td style={{ padding: "12px 15px", fontSize: "14px", color: "#ffffff", borderBottom: "1px solid #1f2937", textAlign: "right" }}>₹{monthlyInterest.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td style={{ padding: "12px 15px", fontSize: "13px", fontWeight: "bold", color: "#9ca3af", borderBottom: "1px solid #1f2937" }}>Date Issued</td>
                  <td style={{ padding: "12px 15px", fontSize: "13px", color: "#ffffff", borderBottom: "1px solid #1f2937", textAlign: "right" }}>{dateGiven}</td>
                </tr>
                <tr>
                  <td style={{ padding: "12px 15px", fontSize: "13px", fontWeight: "bold", color: "#9ca3af" }}>Due Date</td>
                  <td style={{ padding: "12px 15px", fontSize: "14px", fontWeight: "bold", color: "#f87171", textAlign: "right" }}>{dueDate}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Instructions */}
          <div style={{
            backgroundColor: "rgba(212, 175, 55, 0.05)",
            borderLeft: "3px solid #D4AF37",
            padding: "15px",
            borderRadius: "4px",
            margin: "25px 0",
            fontSize: "13px",
            lineHeight: "1.5",
            color: "#e5e7eb"
          }}>
            <strong>Instructions:</strong> Review your loan profile and repayment schedules by opening your secure application link. Keep track of due dates to prevent auto-rollover fees.
          </div>

          {/* Application Link Button */}
          <div style={{ textAlign: "center", margin: "30px 0" }}>
            <a
              href={applicationLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                backgroundColor: "#D4AF37",
                color: "#000000",
                fontSize: "14px",
                fontWeight: "bold",
                textDecoration: "none",
                padding: "12px 30px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(212, 175, 55, 0.25)"
              }}
            >
              Open Secure Application
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "25px 30px",
          borderTop: "1px solid #1f2937",
          backgroundColor: "#0d131f",
          fontSize: "11px",
          color: "#6b7280",
          lineHeight: "1.5",
          textAlign: "left"
        }}>
          This email is automatically generated by Finexa on behalf of the Finexa Credit Control & Legal Division. Finexa complies with the Digital Personal Data Protection (DPDP) Act, 2023 (India) regarding secure storage of financial records.
        </div>
      </div>
    </div>
  );
};
