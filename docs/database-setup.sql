-- ============================================================
-- Budget Tracker — Development Database Setup Script
-- ============================================================
-- This script creates the DEVELOPMENT database and user.
-- For production setup, see database-production.sql.
--
-- Prerequisites:
--   - PostgreSQL server running
--   - Connected as a superuser or admin (e.g., homelab_admin)
--
-- Usage:
--   psql -U homelab_admin -f database-setup.sql
--
-- After running this script, set your .env file:
--   DATABASE_URL="postgresql://budget_app_dev:<password>@localhost:5432/personal_finance_dev"
-- ============================================================

-- 1. Create the development database
CREATE DATABASE personal_finance_dev;

-- 2. Create a dedicated development user with a strong password
--    IMPORTANT: Replace 'CHANGE_ME_TO_A_STRONG_PASSWORD' with a real password!
--    Tip: Generate one with `openssl rand -hex 32` (hex avoids special
--    characters that need URL-encoding in the connection string)
CREATE USER budget_app_dev WITH PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD';

-- 3. Grant CREATEDB — required by Prisma Migrate to create a temporary
--    "shadow database" during `prisma migrate dev`. The shadow DB is used
--    to diff your schema and detect drift, then automatically dropped.
--    This does NOT grant access to other existing databases.
ALTER USER budget_app_dev CREATEDB;

-- 4. Make budget_app_dev the owner of the development database
--    As owner, budget_app_dev has full control over this database
--    (create/alter/drop tables, schemas, etc.) but still cannot access
--    other databases or perform superuser operations. This also solves
--    PostgreSQL 15+ restrictions where the public schema is no longer
--    writable by non-owners.
ALTER DATABASE personal_finance_dev OWNER TO budget_app_dev;

-- ============================================================
-- Verification: run these after the script to confirm setup
-- ============================================================
-- \du budget_app_dev              -- Check user exists
-- \l personal_finance_dev         -- Check database exists
-- \c personal_finance_dev
-- \dp                             -- Check table permissions
-- ============================================================
