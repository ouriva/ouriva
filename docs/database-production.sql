-- ============================================================
-- Budget Tracker — Production Database Setup Script
-- ============================================================
-- This script creates the PRODUCTION database and user.
-- For development setup, see database-setup.sql.
--
-- The production user has restricted permissions — it can only
-- SELECT, INSERT, UPDATE, DELETE on existing tables. It cannot
-- create, alter, or drop tables, create databases, or perform
-- any DDL operations.
--
-- Prerequisites:
--   - PostgreSQL server running
--   - Connected as a superuser or admin (e.g., homelab_admin)
--
-- Usage:
--   psql -U homelab_admin -f database-production.sql
--
-- After running this script, set your production DATABASE_URL to:
--   DATABASE_URL="postgresql://budget_app:<password>@<db-host>:5432/personal_finance"
--
-- Deployment workflow:
--   1. Apply migrations using the dev user (budget_app_dev) which
--      has DDL permissions:
--      DATABASE_URL="...budget_app_dev..." npx prisma migrate deploy
--   2. Run the app using the prod user (budget_app):
--      DATABASE_URL="...budget_app..." npm run start
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
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO budget_app;

-- 7. Grant sequence access (needed for UUID generation and defaults)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO budget_app;

-- 8. Auto-grant on future tables created by budget_app_dev (via migrations)
--    When you run `prisma migrate deploy` as budget_app_dev and new tables
--    are created, budget_app automatically gets CRUD access to them.
--
--    NOTE: For this to work, you need to first make budget_app_dev the
--    owner of the production database so it can run migrations:
--      ALTER DATABASE personal_finance OWNER TO budget_app_dev;
--    After migrations, you can optionally change ownership back.
ALTER DEFAULT PRIVILEGES FOR USER budget_app_dev IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO budget_app;
ALTER DEFAULT PRIVILEGES FOR USER budget_app_dev IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO budget_app;

-- ============================================================
-- Verification
-- ============================================================
-- \du budget_app                  -- Check user exists
-- \c personal_finance
-- \dp                             -- Check table permissions show budget_app
-- ============================================================
