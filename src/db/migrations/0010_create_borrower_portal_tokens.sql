-- ==============================================================================
-- FINEXA BORROWER MAGIC LINK PORTAL TOKENS TABLE
-- MIGRATION ID: 0010_create_borrower_portal_tokens.sql
-- DESCRIPTION: Stores magic link tokens for borrower self-service passbook portal.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "borrower_portal_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "loan_id" uuid NOT NULL REFERENCES "loans"("loan_id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "is_active" boolean NOT NULL DEFAULT true,
  "views_count" integer NOT NULL DEFAULT 0,
  "last_accessed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_bpt_loan_id" ON "borrower_portal_tokens" ("loan_id");
CREATE INDEX IF NOT EXISTS "idx_bpt_token" ON "borrower_portal_tokens" ("token");
