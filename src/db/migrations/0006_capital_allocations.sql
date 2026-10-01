-- ==============================================================================
-- FINEXA CAPITAL ALLOCATION MIGRATION
-- MIGRATION ID: 0006_capital_allocations.sql
-- DESCRIPTION: Connects Loan Management with Capital Management through
--              the capital_allocations table.
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE "allocation_status" AS ENUM ('active', 'returned', 'released', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "capital_allocations" (
  "allocation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "funder_id" uuid NOT NULL REFERENCES "funders"("funder_id") ON DELETE CASCADE,
  "loan_id" uuid NOT NULL REFERENCES "loans"("loan_id") ON DELETE CASCADE,
  "payment_id" uuid REFERENCES "payments"("payment_id") ON DELETE SET NULL,
  "amount" numeric(12, 2) NOT NULL,
  "allocation_date" date NOT NULL DEFAULT CURRENT_DATE,
  "status" "allocation_status" NOT NULL DEFAULT 'active',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_capital_allocations_funder_id" ON "capital_allocations" ("funder_id");
CREATE INDEX IF NOT EXISTS "idx_capital_allocations_loan_id" ON "capital_allocations" ("loan_id");
CREATE INDEX IF NOT EXISTS "idx_capital_allocations_status" ON "capital_allocations" ("status");
CREATE INDEX IF NOT EXISTS "idx_capital_allocations_date" ON "capital_allocations" ("allocation_date");

-- Enforce security lockdown & RLS
REVOKE ALL ON TABLE public.capital_allocations FROM anon;
REVOKE ALL ON TABLE public.capital_allocations FROM authenticated;
GRANT ALL ON TABLE public.capital_allocations TO service_role;
ALTER TABLE public.capital_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow service_role full access to capital_allocations" 
    ON public.capital_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
