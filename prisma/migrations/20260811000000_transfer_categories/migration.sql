-- Step 1: add TRANSFER variant to the CategoryType enum.
ALTER TYPE "CategoryType" ADD VALUE 'TRANSFER';

-- Step 2: seed the three system transfer categories.
-- We use fixed UUIDs so the migration is idempotent (re-runnable on a fresh
-- database without creating duplicates).
INSERT INTO "Category" (id, name, type, "isActive", "excludeFromStats", "parentId", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Transfer',     'TRANSFER', true, false, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Transfer In',  'TRANSFER', true, false, '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'Transfer Out', 'TRANSFER', true, false, '00000000-0000-0000-0000-000000000001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Step 3: migrate existing TRANSFER transactions to the new system categories.
-- Negative amounts   → Transfer Out (money leaving); amount stored as absolute value.
-- Non-negative amounts → Transfer In (money arriving).
UPDATE "Transaction"
SET
  "categoryId" = '00000000-0000-0000-0000-000000000003',
  "amount"     = ABS("amount")
WHERE type = 'TRANSFER'
  AND "amount" < 0
  AND "categoryId" IS NULL;

UPDATE "Transaction"
SET "categoryId" = '00000000-0000-0000-0000-000000000002'
WHERE type = 'TRANSFER'
  AND "amount" >= 0
  AND "categoryId" IS NULL;
