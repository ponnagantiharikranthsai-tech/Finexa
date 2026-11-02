-- ==============================================================================
-- FINEXA DIGITAL ENVELOPE & AUDIT HISTORY TABLES
-- MIGRATION ID: 0011_digital_envelopes.sql
-- DESCRIPTION: Stores digital envelopes (personal & third-party), movement transactions, and account balance settings.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "digital_envelopes" (
  "envelope_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "category" text NOT NULL DEFAULT 'General',
  "type" text NOT NULL DEFAULT 'personal', -- 'personal' | 'third_party'
  "balance" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "target_amount" numeric(12, 2),
  "color" text DEFAULT 'gold',
  "icon" text DEFAULT 'wallet',
  "notes" text,
  "is_archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_digital_envelopes_type" ON "digital_envelopes" ("type");
CREATE INDEX IF NOT EXISTS "idx_digital_envelopes_category" ON "digital_envelopes" ("category");
CREATE INDEX IF NOT EXISTS "idx_digital_envelopes_archived" ON "digital_envelopes" ("is_archived");

CREATE TABLE IF NOT EXISTS "digital_envelope_transactions" (
  "transaction_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "envelope_id" uuid NOT NULL REFERENCES "digital_envelopes"("envelope_id") ON DELETE CASCADE,
  "transaction_type" text NOT NULL, -- 'deposit' | 'withdrawal' | 'pay_bill' | 'initial_deposit'
  "amount" numeric(12, 2) NOT NULL,
  "balance_before" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "balance_after" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "category" text,
  "description" text,
  "reference_party" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_det_envelope_id" ON "digital_envelope_transactions" ("envelope_id");
CREATE INDEX IF NOT EXISTS "idx_det_created_at" ON "digital_envelope_transactions" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_det_type" ON "digital_envelope_transactions" ("transaction_type");

CREATE TABLE IF NOT EXISTS "digital_envelope_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON TABLE public.digital_envelopes TO postgres, service_role;
GRANT ALL ON TABLE public.digital_envelope_transactions TO postgres, service_role;
GRANT ALL ON TABLE public.digital_envelope_settings TO postgres, service_role;
