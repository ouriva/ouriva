-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "proxyCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_proxyCategoryId_fkey" FOREIGN KEY ("proxyCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
