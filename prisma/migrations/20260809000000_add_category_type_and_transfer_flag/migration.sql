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

-- CreateIndex
CREATE INDEX "Transaction_isTransfer_idx" ON "Transaction"("isTransfer");

-- DropForeignKey
ALTER TABLE "AppSettings" DROP CONSTRAINT "AppSettings_transferCategoryId_fkey";

-- AlterTable: drop the now-obsolete column
ALTER TABLE "AppSettings" DROP COLUMN "transferCategoryId";
