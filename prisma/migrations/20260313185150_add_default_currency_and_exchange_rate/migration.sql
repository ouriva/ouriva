-- AlterTable
ALTER TABLE "Currency" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "baseCurrencyAmount" DECIMAL(14,4),
ADD COLUMN     "exchangeRate" DOUBLE PRECISION;
