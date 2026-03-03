-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('CONTAINS', 'STARTS_WITH', 'EXACT', 'REGEX');

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id"         TEXT NOT NULL,
    "pattern"    TEXT NOT NULL,
    "matchType"  "MatchType" NOT NULL DEFAULT 'CONTAINS',
    "priority"   INTEGER NOT NULL DEFAULT 0,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryRule_isActive_idx" ON "CategoryRule"("isActive");

-- CreateIndex
CREATE INDEX "CategoryRule_categoryId_idx" ON "CategoryRule"("categoryId");

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
