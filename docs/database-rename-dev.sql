-- ============================================================
-- Budget Tracker — Rename Dev Database and User
-- ============================================================
-- This script renames the existing dev database and user:
--   personal_finance → personal_finance_dev
--   budget_app       → budget_app_dev
--
-- This frees up the names "personal_finance" and "budget_app"
-- for production use.
--
-- Prerequisites:
--   - Connected as a superuser or admin (e.g., homelab_admin)
--   - Connect to the 'postgres' database (NOT personal_finance)
--   - No active connections to personal_finance
--
-- Usage:
--   psql -U homelab_admin -d postgres -f database-rename-dev.sql
--
-- IMPORTANT: You must NOT be connected to personal_finance when
-- running this. Connect to the 'postgres' database instead.
-- ============================================================

-- 1. Terminate all existing connections to the database.
--    pg_terminate_backend() sends a SIGTERM to each backend process.
--    We exclude our own connection (pid != pg_backend_pid()).
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'personal_finance'
  AND pid != pg_backend_pid();

-- 2. Rename the user first (while the database still has the old name)
ALTER USER budget_app RENAME TO budget_app_dev;

-- 3. Rename the database
--    This requires no active connections to the database.
ALTER DATABASE personal_finance RENAME TO personal_finance_dev;

-- 4. Verify the changes
\echo '--- Verification ---'
\echo 'User should show budget_app_dev:'
\du budget_app_dev
\echo 'Database should show personal_finance_dev:'
\l personal_finance_dev

-- ============================================================
-- After running this script:
--   1. Update your .env file:
--      DATABASE_URL="postgresql://budget_app_dev:<password>@localhost:5432/personal_finance_dev"
--   2. Restart your SSH tunnel if needed
--   3. Test with: npx prisma db pull
-- ============================================================
