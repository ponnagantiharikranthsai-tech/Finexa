-- ==============================================================================
-- FINEXA CAPITAL ALLOCATIONS & LOAN CASCADE SYNCHRONIZATION
-- MIGRATION ID: 0009_sync_capital_on_loan_or_allocation_change.sql
-- DESCRIPTION: Ensures deleting or modifying a loan or capital allocation
--              automatically synchronizes the funder's balances, releasing
--              allocated funds back to unallocated status without ghost records.
-- ==============================================================================

-- 1. Reconcile historical ghost transaction CF-087:
-- Mohan was reduced from 4,000 to 3,000 on Sashi's loan, freeing 1,000 into unallocated capital.
UPDATE "capital_funding_transactions"
SET 
  "amount" = '1000.00', 
  "loan_id" = NULL, 
  "status" = 'received', 
  "notes" = '[Unallocated balance from Sashi loan] ' || COALESCE("notes", '')
WHERE "transaction_code" = 'CF-087' AND "status" = 'allocated';

-- 2. Trigger on loans deletion to release linked funding transactions:
CREATE OR REPLACE FUNCTION fn_sync_capital_on_loan_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "capital_funding_transactions"
  SET 
    "loan_id" = NULL,
    "status" = 'received',
    "notes" = '[Unallocated - Loan Deleted] ' || COALESCE("notes", ''),
    "updated_at" = NOW()
  WHERE "loan_id" = OLD."loan_id";

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_capital_on_loan_delete ON "loans";
CREATE TRIGGER trg_sync_capital_on_loan_delete
BEFORE DELETE ON "loans"
FOR EACH ROW
EXECUTE FUNCTION fn_sync_capital_on_loan_delete();

-- 3. Trigger on capital_allocations deletion to release linked funding transaction:
CREATE OR REPLACE FUNCTION fn_sync_capital_on_allocation_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."funding_transaction_id" IS NOT NULL THEN
    UPDATE "capital_funding_transactions"
    SET 
      "loan_id" = NULL,
      "status" = 'received',
      "notes" = '[Unallocated - Allocation Removed] ' || COALESCE("notes", ''),
      "updated_at" = NOW()
    WHERE "transaction_id" = OLD."funding_transaction_id"
      AND "status" = 'allocated';
  ELSE
    UPDATE "capital_funding_transactions"
    SET 
      "loan_id" = NULL,
      "status" = 'received',
      "notes" = '[Unallocated - Allocation Removed] ' || COALESCE("notes", ''),
      "updated_at" = NOW()
    WHERE "funder_id" = OLD."funder_id"
      AND "loan_id" = OLD."loan_id"
      AND "status" = 'allocated';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_capital_on_allocation_delete ON "capital_allocations";
CREATE TRIGGER trg_sync_capital_on_allocation_delete
AFTER DELETE ON "capital_allocations"
FOR EACH ROW
EXECUTE FUNCTION fn_sync_capital_on_allocation_delete();
