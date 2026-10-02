import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development" });

import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

export async function runCapitalMigration() {
  console.log("Applying on-demand capital schema updates...");

  // 1. Add funding_model to funders if not exists
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'funders' AND column_name = 'funding_model'
      ) THEN
        ALTER TABLE funders ADD COLUMN funding_model text NOT NULL DEFAULT 'on_demand';
      END IF;
    END $$;
  `);

  // 2. Allow default 0.00 for capital_amount, and nullable/default for address & return_due_date
  await db.execute(sql`
    ALTER TABLE funders ALTER COLUMN capital_amount SET DEFAULT 0.00;
    ALTER TABLE funders ALTER COLUMN address DROP NOT NULL;
    ALTER TABLE funders ALTER COLUMN return_due_date DROP NOT NULL;
  `);

  // 3. Create capital_funding_transactions table if not exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS capital_funding_transactions (
      transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_code text NOT NULL UNIQUE,
      funder_id uuid NOT NULL REFERENCES funders(funder_id) ON DELETE CASCADE,
      loan_id uuid REFERENCES loans(loan_id) ON DELETE SET NULL,
      amount numeric(12, 2) NOT NULL,
      funding_date date NOT NULL DEFAULT CURRENT_DATE,
      status text NOT NULL DEFAULT 'allocated',
      notes text,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_cft_funder_id ON capital_funding_transactions(funder_id);
    CREATE INDEX IF NOT EXISTS idx_cft_loan_id ON capital_funding_transactions(loan_id);
    CREATE INDEX IF NOT EXISTS idx_cft_funding_date ON capital_funding_transactions(funding_date);
    CREATE INDEX IF NOT EXISTS idx_cft_status ON capital_funding_transactions(status);
  `);

  // 4. Add funding_transaction_id to capital_allocations if not exists
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'capital_allocations' AND column_name = 'funding_transaction_id'
      ) THEN
        ALTER TABLE capital_allocations ADD COLUMN funding_transaction_id uuid REFERENCES capital_funding_transactions(transaction_id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  console.log("On-demand capital migration applied successfully!");
}

runCapitalMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
