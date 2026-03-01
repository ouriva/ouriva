-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('EXPENSE', 'INCOME');

-- AlterTable: add type column with EXPENSE default
ALTER TABLE "Budget" ADD COLUMN "type" "BudgetType" NOT NULL DEFAULT 'EXPENSE';

-- DropIndex: remove old unique constraint
DROP INDEX "Budget_year_categoryId_key";

-- CreateIndex: new unique constraint including type
CREATE UNIQUE INDEX "Budget_year_categoryId_type_key" ON "Budget"("year", "categoryId", "type");
