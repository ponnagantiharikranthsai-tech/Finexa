-- Migration: 0004_add_missing_loan_applications_columns.sql
-- Ensure all missing columns in loan_applications exist

DO $$ BEGIN
  CREATE TYPE "public"."interest_type" AS ENUM('monthly', 'daily', 'weekly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "application_code" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "principal" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "interest_amount" numeric(12, 2);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "loan_applications" ADD COLUMN "interest_type" "public"."interest_type";
EXCEPTION
  WHEN duplicate_column THEN null;
  WHEN undefined_object THEN
    ALTER TABLE "loan_applications" ADD COLUMN "interest_type" text DEFAULT 'monthly';
END $$;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "start_date" date;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "due_date" date;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "loan_duration" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "customer_name" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "customer_mobile" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "customer_father_name" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "customer_father_mobile" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "customer_email" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "customer_address" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "customer_aadhaar_encrypted" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "customer_pan_encrypted" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "expiry_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "borrower_id" uuid;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "loan_id" uuid;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "pdf_url" text;
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_loan_applications_code" ON "loan_applications" ("application_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_loan_applications_status" ON "loan_applications" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_loan_applications_borrower_id" ON "loan_applications" ("borrower_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_loan_applications_loan_id" ON "loan_applications" ("loan_id");
