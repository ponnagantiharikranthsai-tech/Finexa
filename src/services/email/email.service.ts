import { Resend } from "resend";
import { LoanCreatedEmail } from "./templates/loan-created";
import { LoanReminderEmail } from "./templates/loan-reminder";
import * as React from "react";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export type LoanCreatedEmailPayload = {
  borrowerName: string;
  borrowerEmail: string;
  principal: number;
  monthlyInterest: number;
  interestRate: number;
  dateGiven: string;
  dueDate: string;
};

export type ReminderEmailPayload = {
  borrowerName: string;
  borrowerEmail: string;
  principal: number;
  outstandingBalance: number;
  interestDue: number;
  penaltyAmount: number;
  dueDate: string;
};

export class EmailService {
  async sendLoanCreatedEmail(payload: LoanCreatedEmailPayload): Promise<void> {
    const { error } = await resend.emails.send({
      from: `Finexa <${FROM_EMAIL}>`,
      to: payload.borrowerEmail,
      subject: "Your loan from Finexa has been created",
      react: React.createElement(LoanCreatedEmail, {
        borrowerName: payload.borrowerName,
        principal: payload.principal,
        monthlyInterest: payload.monthlyInterest,
        interestRate: payload.interestRate,
        dateGiven: payload.dateGiven,
        dueDate: payload.dueDate,
      }),
    });

    if (error) {
      throw new Error(`Resend Error: ${error.message}`);
    }
  }

  async sendReminderEmail(payload: ReminderEmailPayload): Promise<void> {
    const { error } = await resend.emails.send({
      from: `Finexa <${FROM_EMAIL}>`,
      to: payload.borrowerEmail,
      subject: `Payment reminder — ₹${payload.outstandingBalance.toLocaleString("en-IN")} due from Finexa`,
      react: React.createElement(LoanReminderEmail, {
        borrowerName: payload.borrowerName,
        principal: payload.principal,
        outstandingBalance: payload.outstandingBalance,
        interestDue: payload.interestDue,
        penaltyAmount: payload.penaltyAmount,
        dueDate: payload.dueDate,
      }),
    });

    if (error) {
      throw new Error(`Resend Error: ${error.message}`);
    }
  }
}

export const emailService = new EmailService();
