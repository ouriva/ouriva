-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- AlterTable: add type column to Category, default EXPENSE for all
ALTER TABLE "Category" ADD COLUMN "type" "CategoryType" NOT NULL DEFAULT 'EXPENSE';

-- DATA MIGRATION: mark categories that have INCOME budget entries as INCOME type
UPDATE "Category"
SET "type" = 'INCOME'
WHERE "id" IN (
  SELECT DISTINCT "categoryId" FROM "Budget" WHERE "type" = 'INCOME'
);

-- CreateIndex
CREATE INDEX "Category_type_idx" ON "Category"("type");

-- AlterTable: add isTransfer flag to Transaction, default false for all
ALTER TABLE "Transaction" ADD COLUMN "isTransfer" BOOLEAN NOT NULL DEFAULT false;

-- DATA MIGRATION: mark transactions that belong to the current transfer category as transfers.
UPDATE "Transaction"
SET "isTransfer" = true,
    "categoryId" = NULL
WHERE "categoryId" = (SELECT "transferCategoryId" FROM "AppSettings" WHERE "id" = 'singleton')
   OR "parentTransactionId" IN (
     SELECT "id" FROM "Transaction"
     WHERE "categoryId" = (SELECT "transferCategoryId" FROM "AppSettings" WHERE "id" = 'singleton')
   );

-- CreateIndex
CREATE INDEX "Transaction_isTransfer_idx" ON "Transaction"("isTransfer");

-- DropForeignKey
ALTER TABLE "AppSettings" DROP CONSTRAINT "AppSettings_transferCategoryId_fkey";

-- AlterTable: drop the now-obsolete column
ALTER TABLE "AppSettings" DROP COLUMN "transferCategoryId";
