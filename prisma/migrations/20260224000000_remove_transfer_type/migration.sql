-- Step 1: Convert existing TRANSFER transactions to EXPENSE
UPDATE "Transaction" SET "type" = 'EXPENSE' WHERE "type" = 'TRANSFER';

-- Step 2: Drop foreign key and index for toAccountId
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_toAccountId_fkey";
DROP INDEX IF EXISTS "Transaction_toAccountId_idx";

-- Step 3: Drop toAccountId and toAmount columns
ALTER TABLE "Transaction" DROP COLUMN "toAccountId";
ALTER TABLE "Transaction" DROP COLUMN "toAmount";

-- Step 4: Remove TRANSFER from the TransactionType enum
-- PostgreSQL requires create-rename-drop since you can't remove a value from an enum
CREATE TYPE "TransactionType_new" AS ENUM ('INCOME', 'EXPENSE');
ALTER TABLE "Transaction" ALTER COLUMN "type" TYPE "TransactionType_new" USING ("type"::text::"TransactionType_new");
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "TransactionType_old";

-- Step 5: Create AppSettings table
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "transferCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- Step 6: Add foreign key for transferCategoryId
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_transferCategoryId_fkey"
    FOREIGN KEY ("transferCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
