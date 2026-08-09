-- Add TRANSFER value to the TransactionType enum
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

-- DATA MIGRATION: transactions previously marked isTransfer=true become type='TRANSFER'.
-- The TRANSFER type replaces the boolean flag — direction is no longer tracked for
-- transfer transactions because they are excluded from income/expense reports entirely.
UPDATE "Transaction"
SET "type" = 'TRANSFER'
WHERE "isTransfer" = true;

-- DropIndex
DROP INDEX "Transaction_isTransfer_idx";

-- AlterTable: remove the boolean flag now that type=TRANSFER carries the same meaning
ALTER TABLE "Transaction" DROP COLUMN "isTransfer";
