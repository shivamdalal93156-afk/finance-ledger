-- Migration: 20260722000000_add_client_id_idempotency.sql
-- Add client_id UUID NOT NULL UNIQUE to transactions and customers for idempotency

-- ---------------------------------------------------------------------------
-- 1. TRANSACTIONS TABLE
-- ---------------------------------------------------------------------------
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS client_id UUID DEFAULT gen_random_uuid();

UPDATE transactions 
  SET client_id = gen_random_uuid() 
  WHERE client_id IS NULL;

ALTER TABLE transactions 
  ALTER COLUMN client_id SET NOT NULL;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_client_id_key'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_client_id_key UNIQUE (client_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. CUSTOMERS TABLE
-- ---------------------------------------------------------------------------
ALTER TABLE customers 
  ADD COLUMN IF NOT EXISTS client_id UUID DEFAULT gen_random_uuid();

UPDATE customers 
  SET client_id = gen_random_uuid() 
  WHERE client_id IS NULL;

ALTER TABLE customers 
  ALTER COLUMN client_id SET NOT NULL;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_client_id_key'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_client_id_key UNIQUE (client_id);
  END IF;
END $$;
