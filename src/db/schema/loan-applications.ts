import { pgTable, uuid, text, numeric, date, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { borrowersTable } from "./borrowers";
import { loansTable, interestTypeEnum } from "./loans";

export const loanApplicationsTable = pgTable("loan_applications", {
  applicationId: uuid("application_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  applicationCode: text("application_code").notNull().unique(), // e.g. LN-2026-000123

  principal: numeric("principal", { precision: 12, scale: 2 }).notNull(),
  interestAmount: numeric("interest_amount", { precision: 12, scale: 2 }).notNull(),
  interestType: interestTypeEnum("interest_type").notNull(),

  startDate: date("start_date").notNull(),
  dueDate: date("due_date").notNull(),
  loanDuration: text("loan_duration").notNull(),
  notes: text("notes"),

  customerName: text("customer_name"),
  customerMobile: text("customer_mobile"),
  customerFatherName: text("customer_father_name"),
  customerFatherMobile: text("customer_father_mobile"),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address"),
  customerAadhaarEncrypted: text("customer_aadhaar_encrypted"),
  customerPanEncrypted: text("customer_pan_encrypted"),

  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  status: text("status").notNull().default("active"), // active, pending_verification, approved, expired

  borrowerId: uuid("borrower_id")
    .references(() => borrowersTable.borrowerId),

  loanId: uuid("loan_id")
    .references(() => loansTable.loanId),

  pdfUrl: text("pdf_url"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_loan_applications_code").on(table.applicationCode),
  index("idx_loan_applications_status").on(table.status),
  index("idx_loan_applications_borrower_id").on(table.borrowerId),
  index("idx_loan_applications_loan_id").on(table.loanId),
]);

export type LoanApplication = typeof loanApplicationsTable.$inferSelect;
export type InsertLoanApplication = typeof loanApplicationsTable.$inferInsert;
