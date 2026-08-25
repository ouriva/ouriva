-- Set the icon on the system Transfer categories. There's no Settings UI
-- for TRANSFER-type categories (they're system-managed and excluded from
-- the category tree editor), so this is applied directly via migration
-- rather than through the app. ArrowLeftRight must already be registered
-- in src/lib/category-icons.ts (CATEGORY_ICONS) for it to render — see
-- the icon lookup in components/ui/category-icon.tsx.
UPDATE "Category"
SET icon = 'ArrowLeftRight'
WHERE type = 'TRANSFER';

-- Color-code direction: green for money arriving, red for money leaving.
-- Both keys already exist in CATEGORY_COLORS (src/lib/category-icons.ts),
-- no code change needed for these to render.
UPDATE "Category"
SET color = 'emerald'
WHERE id = '00000000-0000-0000-0000-000000000002';  -- Transfer In

UPDATE "Category"
SET color = 'red'
WHERE id = '00000000-0000-0000-0000-000000000003';  -- Transfer Out
