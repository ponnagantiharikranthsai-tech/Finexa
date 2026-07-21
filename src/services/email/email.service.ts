import { Resend } from "resend";
import { LoanCreatedEmail } from "./templates/loan-created";
import { LoanReminderEmail } from "./templates/loan-reminder";
import * as React from "react";
import { db } from "@/db/client";
import { loanApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export type LoanCreatedEmailPayload = {
  loanId: string;
  borrowerName: string;
  borrowerEmail: string;
  principal: number;
  monthlyInterest: number;
  interestRate: number;
  dateGiven: string;
  dueDate: string;
};

export type ReminderEmailPayload = {
  loanId: string;
  borrowerName: string;
  borrowerEmail: string;
  principal: number;
  outstandingBalance: number;
  interestDue: number;
  penaltyAmount: number;
  dueDate: string;
};

export class EmailService {
  private async getApplicationLink(loanId: string): Promise<string> {
    try {
      const [app] = await db
        .select({ applicationCode: loanApplicationsTable.applicationCode })
        .from(loanApplicationsTable)
        .where(eq(loanApplicationsTable.loanId, loanId))
        .limit(1);
      
      if (app?.applicationCode) {
        return `${process.env.NEXT_PUBLIC_APP_URL || "https://finexa-tzxa.vercel.app"}/apply/${app.applicationCode}`;
      }
    } catch (err) {
      console.error("Failed to query application link for email:", err);
    }
    return process.env.NEXT_PUBLIC_APP_URL || "https://finexa-tzxa.vercel.app";
  }

  async sendLoanCreatedEmail(payload: LoanCreatedEmailPayload): Promise<void> {
    const appLink = await this.getApplicationLink(payload.loanId);
    
    const plainText = `📋 FINEXA Loan Confirmation

Dear ${payload.borrowerName},

Your loan file from FINEXA has been created.
- Principal Amount: ₹${payload.principal.toLocaleString("en-IN")}
- Monthly Interest Owed: ₹${payload.monthlyInterest.toLocaleString("en-IN")}
- Repayment Due Date: ${payload.dueDate}

To check your details or submit updates, follow this secure link:
${appLink}

Thank you,
FINEXA – Smart Loan Management.`;

    const { error } = await resend.emails.send({
      from: `Finexa <${FROM_EMAIL}>`,
      to: payload.borrowerEmail,
      subject: "Your loan from Finexa has been created",
      text: plainText,
      react: React.createElement(LoanCreatedEmail, {
        borrowerName: payload.borrowerName,
        principal: payload.principal,
        monthlyInterest: payload.monthlyInterest,
        interestRate: payload.interestRate,
        dateGiven: payload.dateGiven,
        dueDate: payload.dueDate,
        applicationLink: appLink,
      }),
    });

    if (error) {
      throw new Error(`Resend Error: ${error.message}`);
    }
  }

  async sendReminderEmail(payload: ReminderEmailPayload): Promise<void> {
    const appLink = await this.getApplicationLink(payload.loanId);
    
    const plainText = `⏰ FINEXA Repayment Reminder

Dear ${payload.borrowerName},

This is a reminder that your loan repayment of ₹${payload.outstandingBalance.toLocaleString("en-IN")} is due on ${payload.dueDate}.
- Principal: ₹${payload.principal.toLocaleString("en-IN")}
- Outstanding Balance: ₹${payload.outstandingBalance.toLocaleString("en-IN")}
- Interest Due: ₹${payload.interestDue.toLocaleString("en-IN")}
- Late Penalty: ₹${payload.penaltyAmount.toLocaleString("en-IN")}

Secure Application Link:
${appLink}

Please clear your dues on time to avoid late fees.

Thank you,
FINEXA – Smart Loan Management.`;

    const { error } = await resend.emails.send({
      from: `Finexa <${FROM_EMAIL}>`,
      to: payload.borrowerEmail,
      subject: `Payment reminder — ₹${payload.outstandingBalance.toLocaleString("en-IN")} due from Finexa`,
      text: plainText,
      react: React.createElement(LoanReminderEmail, {
        borrowerName: payload.borrowerName,
        principal: payload.principal,
        outstandingBalance: payload.outstandingBalance,
        interestDue: payload.interestDue,
        penaltyAmount: payload.penaltyAmount,
        dueDate: payload.dueDate,
        applicationLink: appLink,
      }),
    });

    if (error) {
      throw new Error(`Resend Error: ${error.message}`);
    }
  }
}

export const emailService = new EmailService();
