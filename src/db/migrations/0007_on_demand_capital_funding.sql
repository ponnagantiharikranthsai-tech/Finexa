-- ==============================================================================
-- FINEXA ON-DEMAND CAPITAL FUNDING MIGRATION
-- MIGRATION ID: 0007_on_demand_capital_funding.sql
-- DESCRIPTION: Replaces capital pool model with On-Demand Capital Funding.
--              Capital persons are funding contacts, each funding event
--              is individually recorded and linked to loans.
-- ==============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funders' AND column_name = 'funding_model'
  ) THEN
    ALTER TABLE "funders" ADD COLUMN "funding_model" text NOT NULL DEFAULT 'on_demand';
  END IF;
END $$;

ALTER TABLE "funders" ALTER COLUMN "capital_amount" SET DEFAULT 0.00;
ALTER TABLE "funders" ALTER COLUMN "address" DROP NOT NULL;
ALTER TABLE "funders" ALTER COLUMN "return_due_date" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "capital_funding_transactions" (
  "transaction_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_code" text NOT NULL UNIQUE,
  "funder_id" uuid NOT NULL REFERENCES "funders"("funder_id") ON DELETE CASCADE,
  "loan_id" uuid REFERENCES "loans"("loan_id") ON DELETE SET NULL,
  "amount" numeric(12, 2) NOT NULL,
  "funding_date" date NOT NULL DEFAULT CURRENT_DATE,
  "status" text NOT NULL DEFAULT 'allocated',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_cft_funder_id" ON "capital_funding_transactions" ("funder_id");
CREATE INDEX IF NOT EXISTS "idx_cft_loan_id" ON "capital_funding_transactions" ("loan_id");
CREATE INDEX IF NOT EXISTS "idx_cft_funding_date" ON "capital_funding_transactions" ("funding_date");
CREATE INDEX IF NOT EXISTS "idx_cft_status" ON "capital_funding_transactions" ("status");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'capital_allocations' AND column_name = 'funding_transaction_id'
  ) THEN
    ALTER TABLE "capital_allocations" ADD COLUMN "funding_transaction_id" uuid REFERENCES "capital_funding_transactions"("transaction_id") ON DELETE SET NULL;
  END IF;
END $$;

-- Enforce security lockdown & RLS
REVOKE ALL ON TABLE public.capital_funding_transactions FROM anon;
REVOKE ALL ON TABLE public.capital_funding_transactions FROM authenticated;
GRANT ALL ON TABLE public.capital_funding_transactions TO service_role;
ALTER TABLE public.capital_funding_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow service_role full access to capital_funding_transactions" 
    ON public.capital_funding_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
