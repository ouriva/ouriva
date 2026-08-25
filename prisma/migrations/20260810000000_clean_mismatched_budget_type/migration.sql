-- Step 1: delete stale Budget rows where Budget.type doesn't match Category.type.
-- These were written while category types were temporarily wrong during the
-- cascade bug. After this, at most one row exists per (year, categoryId).
DELETE FROM "Budget" b
USING "Category" c
WHERE b."categoryId" = c.id
  AND b."type"::text != c."type"::text;

-- Step 2: drop the old unique index that included type.
DROP INDEX "Budget_year_categoryId_type_key";

-- Step 3: recreate the unique index on (year, categoryId) only.
CREATE UNIQUE INDEX "Budget_year_categoryId_key" ON "Budget"("year", "categoryId");

-- Step 4: drop the type column — redundant because Category.type already
-- determines which side (income/expense) a budget entry belongs to.
ALTER TABLE "Budget" DROP COLUMN "type";

-- Step 5: drop the BudgetType enum — no column references it anymore.
DROP TYPE "BudgetType";
