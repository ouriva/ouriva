-- Add excludeFromStats flag to Category
-- This replaces the single proxyCategoryId on AppSettings with a per-category
-- flag. Any category marked excludeFromStats is excluded from summaries, same
-- as the old proxy category was.

-- Step 1: Add the new column (nullable initially to allow the data migration)
ALTER TABLE "Category" ADD COLUMN "excludeFromStats" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Index for performant filtering in summary queries
CREATE INDEX "Category_excludeFromStats_idx" ON "Category"("excludeFromStats");

-- Step 3: Data migration — carry the existing proxy category forward.
-- The old proxyCategoryId pointed to one category; we set its flag to true
-- so no configuration is lost when we drop the column.
UPDATE "Category" SET "excludeFromStats" = true
WHERE id IN (
  SELECT "proxyCategoryId" FROM "AppSettings"
  WHERE id = 'singleton' AND "proxyCategoryId" IS NOT NULL
);

-- Step 4: Drop the old FK constraint and column from AppSettings
ALTER TABLE "AppSettings" DROP CONSTRAINT IF EXISTS "AppSettings_proxyCategoryId_fkey";
ALTER TABLE "AppSettings" DROP COLUMN IF EXISTS "proxyCategoryId";
