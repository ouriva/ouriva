-- ============================================================
-- Budget Tracker — Database Setup Script
-- ============================================================
-- This script creates a dedicated database and user for the
-- Budget Tracker application with minimal required privileges.
--
-- Prerequisites:
--   - PostgreSQL server running
--   - Connected as a superuser or admin (e.g., homelab_admin)
--
-- Usage:
--   psql -U homelab_admin -f database-setup.sql
--
-- After running this script, update your .env file with:
--   DATABASE_URL="postgresql://budget_app:<password>@localhost:5432/personal_finance"
-- ============================================================

-- 1. Create the application database (skip if already exists)
-- SELECT 'CREATE DATABASE personal_finance'
-- WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'personal_finance')\gexec
CREATE DATABASE personal_finance;

-- 2. Create a dedicated user with a strong password
--    IMPORTANT: Replace 'CHANGE_ME_TO_A_STRONG_PASSWORD' with a real password!
--    Tip: Generate one with `openssl rand -hex 32` (hex avoids special
--    characters that need URL-encoding in the connection string)
CREATE USER budget_app WITH PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD';

-- 2b. Grant CREATEDB — required by Prisma Migrate to create a temporary
--     "shadow database" during `prisma migrate dev`. The shadow DB is used
--     to diff your schema and detect drift, then automatically dropped.
--     This does NOT grant access to other existing databases.
ALTER USER budget_app CREATEDB;

-- 3. Make budget_app the owner of the personal_finance database
--    As owner, budget_app has full control over this database (create/alter/drop
--    tables, schemas, etc.) but still cannot access other databases or perform
--    superuser operations. This also solves PostgreSQL 15+ restrictions where
--    the public schema is no longer writable by non-owners, which is required
--    for Prisma's shadow database to work correctly.
ALTER DATABASE personal_finance OWNER TO budget_app;

-- ============================================================
-- Verification: run these after the script to confirm setup
-- ============================================================
-- \du budget_app                 -- Check user exists
-- \l personal_finance            -- Check database exists
-- \c personal_finance
-- \dp                            -- Check table permissions
-- ============================================================
