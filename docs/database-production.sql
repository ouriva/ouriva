-- ============================================================
-- Spendtinel — Production Database Setup Script
-- ============================================================
-- This script creates the PRODUCTION database and user.
-- For development setup, see database-setup.sql.
--
-- Two users are involved in production:
--   - db_admin:   Runs migrations (CREATE TABLE, ALTER, etc.)
--     You already have this user. No changes needed to it.
--   - budget_app: Runs the app (SELECT, INSERT, UPDATE, DELETE)
--     This script creates it with restricted permissions.
--
-- Prerequisites:
--   - PostgreSQL server running
--   - Connected as a superuser or admin (e.g., db_admin)
--
-- Usage:
--   psql -U db_admin -f database-production.sql
--
-- After running this script, set your production DATABASE_URL to:
--   DATABASE_URL="postgresql://budget_app:<password>@<db-host>:5432/personal_finance"
-- ============================================================

-- 1. Create the production database
CREATE DATABASE personal_finance;

-- 2. Create the production user with a strong password
--    IMPORTANT: Replace 'CHANGE_ME_TO_A_STRONG_PASSWORD' with a real password!
--    Tip: Generate one with `openssl rand -hex 32`
CREATE USER budget_app WITH PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD';

-- 3. Allow connection ONLY to the personal_finance database
GRANT CONNECT ON DATABASE personal_finance TO budget_app;

-- 4. Switch to the personal_finance database
\c personal_finance

-- 5. Grant schema usage (read-only access to schema structure)
--    Does NOT include CREATE — this user cannot make new tables
GRANT USAGE ON SCHEMA public TO budget_app;

-- 6. Grant CRUD on all existing tables
--    No ALTER, DROP, TRUNCATE, or REFERENCES — only data operations
--    NOTE: If you run this BEFORE migrations, these grant on zero tables.
--    After running migrations, re-run steps 6 and 7 to grant on the
--    newly created tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO budget_app;

-- 7. Grant sequence access (needed for UUID generation and defaults)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO budget_app;

-- 8. Auto-grant on future tables created by db_admin (via migrations)
--    When you run `prisma migrate deploy` as db_admin and new tables
--    are created, budget_app automatically gets CRUD access to them.
ALTER DEFAULT PRIVILEGES FOR USER db_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO budget_app;
ALTER DEFAULT PRIVILEGES FOR USER db_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO budget_app;

-- ============================================================
-- Verification
-- ============================================================
-- \du budget_app                  -- Check user exists
-- \c personal_finance
-- \dp                             -- Check table permissions show budget_app
-- ============================================================
