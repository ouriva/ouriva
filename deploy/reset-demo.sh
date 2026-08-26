#!/usr/bin/env bash

# ============================================================
# Ouriva — Demo Reset Script
# ============================================================
# Wipes the public demo instance back to a clean, seeded state.
# Meant to run on a schedule (e.g. nightly via cron) so a demo
# visitor never finds data left behind by a previous visitor.
#
# Why a full wipe instead of re-running the seed on top of the
# existing data: prisma/seed.ts creates rows with plain `create`
# calls (no natural unique key to upsert against for accounts,
# transactions, etc.), so running it twice against the same
# database would duplicate everything rather than reset it.
# Dropping the volume and starting over is the only version of
# "reset" that's actually idempotent.
#
# Why migrations/seed run via a separate "migrator" image
# instead of `docker compose exec app ...`: the production
# Dockerfile's final stage deliberately removes npm/npx to
# shrink its attack surface (see Dockerfile comments), so the
# running app container has no way to invoke Prisma. The
# "builder" stage, one step earlier in the same multi-stage
# build, still has the full toolchain — we build that stage
# under its own tag and run it once, throwaway, just for this.
#
# Usage (run from the ouriva-app repo root on the host):
#   ./deploy/reset-demo.sh
#
# Cron (runs nightly at 4am server time):
#   0 4 * * * cd /path/to/ouriva-app && ./deploy/reset-demo.sh >> /var/log/ouriva-demo-reset.log 2>&1
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"
ENV_FILE="${SCRIPT_DIR}/.env.demo"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.demo.yml"
PROJECT_NAME="ouriva-demo"
MIGRATOR_IMAGE="ouriva:migrator"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Error: ${ENV_FILE} not found."
  echo "Create it first: cp deploy/.env.demo.example deploy/.env.demo"
  echo "Then set DEMO_DB_PASSWORD to the output of: openssl rand -hex 16"
  exit 1
fi

echo "=== Ouriva demo reset — $(date -u +"%Y-%m-%d %H:%M:%S UTC") ==="

# ----------------------------------------------------------
# Step 1: Wipe the stack, including the database volume.
# ----------------------------------------------------------
echo "[1/4] Tearing down demo stack (including volume)..."
docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" down -v

# ----------------------------------------------------------
# Step 2: Rebuild and bring the stack back up.
# --build picks up any code changes deployed since the last
# reset without requiring a separate deploy step.
# ----------------------------------------------------------
echo "[2/4] Rebuilding and starting demo stack..."
docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build

echo "      Waiting for the database to be healthy..."
until docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T db pg_isready -U ouriva -d ouriva >/dev/null 2>&1; do
  sleep 1
done
echo "      Database is ready."

# ----------------------------------------------------------
# Step 3: Build the migrator image (cached after first run;
# only rebuilds when source changes).
# ----------------------------------------------------------
echo "[3/4] Building migrator image..."
docker build --target builder -t "${MIGRATOR_IMAGE}" "${PROJECT_DIR}"

# ----------------------------------------------------------
# Step 4: Apply migrations and seed fresh demo data.
# Runs on the same Compose network so "db" resolves via
# Docker's internal DNS, exactly like the app container does.
# ----------------------------------------------------------
echo "[4/4] Running migrations and seeding demo data..."
# shellcheck disable=SC1090
source "${ENV_FILE}"
docker run --rm \
  --network "${PROJECT_NAME}_default" \
  -e "DATABASE_URL=postgresql://ouriva:${DEMO_DB_PASSWORD}@db:5432/ouriva" \
  "${MIGRATOR_IMAGE}" \
  sh -c "npx prisma migrate deploy && npx prisma db seed"

echo ""
echo "=== Demo reset complete — $(date -u +"%Y-%m-%d %H:%M:%S UTC") ==="
