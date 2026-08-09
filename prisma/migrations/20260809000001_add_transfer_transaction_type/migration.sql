-- Add TRANSFER value to the TransactionType enum
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

-- DropIndex
DROP INDEX "Transaction_isTransfer_idx";

-- AlterTable: remove the boolean flag now that type=TRANSFER carries the same meaning
ALTER TABLE "Transaction" DROP COLUMN "isTransfer";
