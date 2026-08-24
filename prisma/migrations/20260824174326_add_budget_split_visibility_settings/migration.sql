-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "budgetSplitEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "budgetSplitInBudget" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "budgetSplitInSummary" BOOLEAN NOT NULL DEFAULT true;
