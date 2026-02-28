-- Clear category assignments on transactions where the category is a parent
-- (i.e., has at least one child category). These transactions become uncategorized.
-- This enforces the leaf-only assignment model going forward.
UPDATE "Transaction"
SET "categoryId" = NULL
WHERE "categoryId" IN (
  SELECT DISTINCT c.id
  FROM "Category" c
  WHERE EXISTS (
    SELECT 1 FROM "Category" child WHERE child."parentId" = c.id
  )
);
