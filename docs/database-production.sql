-- ============================================================
-- Budget Tracker — Production Database User Setup
-- ============================================================
-- This script creates a restricted user for production use.
-- The production user can only SELECT, INSERT, UPDATE, DELETE
-- on existing tables — it cannot create, alter, or drop tables,
-- create databases, or perform any DDL operations.
--
-- Prerequisites:
--   - database-setup.sql has already been run
--   - Connected as a superuser or admin (e.g., homelab_admin)
--
-- Usage:
--   psql -U homelab_admin -f database-production.sql
--
-- After running this script, set the production DATABASE_URL to:
--   DATABASE_URL="postgresql://budget_app_prod:<password>@localhost:5432/personal_finance"
--
-- Deployment workflow:
--   1. Apply migrations using the dev user (budget_app):
--      DATABASE_URL="...budget_app..." npx prisma migrate deploy
--   2. Run the app using the prod user (budget_app_prod):
--      DATABASE_URL="...budget_app_prod..." npm run start
-- ============================================================

-- 1. Create the production user with a strong password
--    IMPORTANT: Replace 'CHANGE_ME_TO_A_STRONG_PASSWORD' with a real password!
--    Tip: Generate one with `openssl rand -hex 32`
CREATE USER budget_app_prod WITH PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD';

-- 2. Allow connection ONLY to the personal_finance database
GRANT CONNECT ON DATABASE personal_finance TO budget_app_prod;

-- 3. Switch to the personal_finance database
\c personal_finance

-- 4. Grant schema usage (read-only access to schema structure)
--    Does NOT include CREATE — this user cannot make new tables
GRANT USAGE ON SCHEMA public TO budget_app_prod;

-- 5. Grant CRUD on all existing tables
--    No ALTER, DROP, TRUNCATE, or REFERENCES — only data operations
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO budget_app_prod;

-- 6. Grant sequence access (needed for UUID generation and defaults)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO budget_app_prod;

-- 7. Auto-grant on future tables created by budget_app (via migrations)
--    When you run `prisma migrate deploy` as budget_app and new tables are
--    created, budget_app_prod automatically gets CRUD access to them
ALTER DEFAULT PRIVILEGES FOR USER budget_app IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO budget_app_prod;
ALTER DEFAULT PRIVILEGES FOR USER budget_app IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO budget_app_prod;

-- ============================================================
-- Verification
-- ============================================================
-- \du budget_app_prod            -- Check user exists
-- \c personal_finance
-- \dp                            -- Check table permissions show budget_app_prod
-- ============================================================
