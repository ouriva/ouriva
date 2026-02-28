-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "parentTransactionId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_parentTransactionId_idx" ON "Transaction"("parentTransactionId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
