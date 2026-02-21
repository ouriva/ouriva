-- CreateTable
CREATE TABLE "ImportProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "columnMap" JSONB NOT NULL,
    "dateFormat" TEXT NOT NULL DEFAULT 'yyyy-MM-dd',
    "delimiter" TEXT,
    "skipRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportProfile_name_key" ON "ImportProfile"("name");
