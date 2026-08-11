#!/usr/bin/env bash

# ============================================================
# Ouriva — Deploy Script
# ============================================================
# Builds the Docker image on your Mac, backs up the production
# database (only when a migration is about to run), runs the
# migration, transfers the image to the Raspberry Pi, and
# restarts the app.
#
# The image version is read from the latest git tag (e.g. v1.0.0).
# The image is tagged as both the version and "latest" so
# docker-compose.yml doesn't need updating per deploy.
#
# Configuration is read from .env.production.local (gitignored).
# To set up, copy the example file and fill in your values:
#   cp .env.production.example .env.production.local
#
# Usage:
#   git tag v1.0.0          # tag your release first
#   ./scripts/deploy.sh     # builds and deploys that version
#
# What this script does:
#   1. Reads the version from the latest git tag
#   2. Builds the Docker image locally on your Mac
#   3. Checks for pending migrations; if any, backs up the database
#      to external storage first
#   4. Runs Prisma migrations against the production database
#   5. Exports the image to a compressed file
#   6. Transfers it to the Raspberry Pi via SSH
#   7. Loads the image and restarts the container on the Pi
# ============================================================

set -euo pipefail  # Exit on any error, undefined variable, or pipe failure

# ============================================================
# Load configuration from .env.production.local
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"
ENV_FILE="${PROJECT_DIR}/.env.production.local"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Error: ${ENV_FILE} not found."
  echo ""
  echo "Create it by copying the example:"
  echo "  cp .env.production.example .env.production.local"
  echo "  # Then edit .env.production.local with your actual values"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

# Verify required variables are set
for var in PI_SSH PI_APP_DIR DB_SSH MIGRATE_DB_URL BACKUP_SSH BACKUP_DIR; do
  if [ -z "${!var:-}" ]; then
    echo "Error: ${var} is not set in ${ENV_FILE}"
    exit 1
  fi
done

# ============================================================
# Determine version from git tag
# ============================================================
# git describe --tags --abbrev=0 returns the latest tag on the
# current branch (e.g. "v1.0.0"). If no tags exist, the script
# exits with an error prompting you to create one.

IMAGE_NAME="ouriva"
VERSION=$(git -C "${PROJECT_DIR}" describe --tags --abbrev=0 2>/dev/null || true)

if [ -z "${VERSION}" ]; then
  echo "Error: No git tag found."
  echo ""
  echo "Create a version tag first:"
  echo "  git tag v1.0.0"
  echo "  ./scripts/deploy.sh"
  exit 1
fi

# Warn about uncommitted changes but continue — the Docker build
# captures the full working tree so the deployed image reflects
# the actual current state regardless.
if [ -n "$(git -C "${PROJECT_DIR}" status --porcelain)" ]; then
  echo "Warning: You have uncommitted changes:"
  git -C "${PROJECT_DIR}" status --short
  echo ""
fi

# Check the tag points to the current commit
TAG_COMMIT=$(git -C "${PROJECT_DIR}" rev-list -n 1 "${VERSION}")
HEAD_COMMIT=$(git -C "${PROJECT_DIR}" rev-parse HEAD)
if [ "${TAG_COMMIT}" != "${HEAD_COMMIT}" ]; then
  echo "Warning: Tag ${VERSION} does not point to the current commit."
  echo "  Tag points to:  ${TAG_COMMIT:0:8}"
  echo "  HEAD is at:     ${HEAD_COMMIT:0:8}"
  read -p "Deploy anyway? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "=== Ouriva Deploy — ${VERSION} ==="
echo ""

# ----------------------------------------------------------
# Step 1: Build the Docker image
# ----------------------------------------------------------
echo "[1/7] Building Docker image (${VERSION})..."
# Tag with both the version and "latest".
# "latest" is what docker-compose.yml references, so it always
# picks up the most recently deployed version.
docker build \
  -t "${IMAGE_NAME}:${VERSION}" \
  -t "${IMAGE_NAME}:latest" \
  "${PROJECT_DIR}"
echo "      Done."
echo ""

# ----------------------------------------------------------
# Open the DB tunnel once — shared by the backup check, the
# optional backup itself, and the migration in the next step.
# ----------------------------------------------------------
EXISTING_PID=$(lsof -ti :5433 2>/dev/null || true)
CREATED_TUNNEL=false

if [ -n "${EXISTING_PID}" ]; then
  echo "      Port 5433 already in use (PID ${EXISTING_PID}) — reusing existing tunnel."
else
  echo "      Starting SSH tunnel to DB server (port 5433)..."
  # -f = fork to background after authentication
  # -N = no remote command (tunnel only)
  # -L = forward local port 5433 to remote port 5432
  ssh -f -N -L 5433:localhost:5432 "${DB_SSH}"
  CREATED_TUNNEL=true
  sleep 2
fi

# ----------------------------------------------------------
# Step 2: Back up the database, but only if a migration is
# about to run. `prisma migrate status` prints "up to date"
# and exits 0 when there's nothing pending — anything else
# means migrate deploy is about to change the schema, so we
# back up first.
# ----------------------------------------------------------
echo "[2/7] Checking for pending migrations..."
MIGRATE_STATUS_OUTPUT=$(DATABASE_URL="${MIGRATE_DB_URL}" npx prisma migrate status --schema="${PROJECT_DIR}/prisma/schema.prisma" 2>&1) || true
echo "${MIGRATE_STATUS_OUTPUT}"

if echo "${MIGRATE_STATUS_OUTPUT}" | grep -q "Database schema is up to date"; then
  echo "      No pending migrations — skipping backup."
else
  echo "      Pending migration detected — backing up database first."
  # Reuse the postgres:16 image as a throwaway pg_dump client so this
  # script doesn't require Postgres tools installed on the Mac.
  # host.docker.internal reaches the Mac's localhost from inside the
  # container, which is where the SSH tunnel above is bound.
  BACKUP_FILE="personal_finance-pre_migration-${VERSION}-$(date +%Y%m%d_%H%M%S).dump"
  DOCKER_DB_URL="${MIGRATE_DB_URL/localhost/host.docker.internal}"

  mkdir -p /tmp/ouriva-backup
  docker run --rm \
    -v /tmp/ouriva-backup:/backup \
    postgres:16 \
    pg_dump "${DOCKER_DB_URL}" -F c -f "/backup/${BACKUP_FILE}"

  ssh "${BACKUP_SSH}" "mkdir -p '${BACKUP_DIR}'"
  scp "/tmp/ouriva-backup/${BACKUP_FILE}" "${BACKUP_SSH}:${BACKUP_DIR}/${BACKUP_FILE}"
  rm -rf /tmp/ouriva-backup

  echo "      Backup saved: ${BACKUP_SSH}:${BACKUP_DIR}/${BACKUP_FILE}"
fi
echo ""

# ----------------------------------------------------------
# Step 3: Run production database migrations
# ----------------------------------------------------------
echo "[3/7] Running production database migrations..."

DATABASE_URL="${MIGRATE_DB_URL}" npx prisma migrate deploy --schema="${PROJECT_DIR}/prisma/schema.prisma"

# Only kill the tunnel if we created it
if [ "${CREATED_TUNNEL}" = true ]; then
  TUNNEL_PID=$(lsof -ti :5433 2>/dev/null || true)
  kill "${TUNNEL_PID}" 2>/dev/null || true
fi
echo "      Migrations applied."
echo ""

# ----------------------------------------------------------
# Step 4: Export the image to a compressed file
# ----------------------------------------------------------
echo "[4/7] Exporting Docker image..."
# Save both tags so the Pi has version + latest
docker save "${IMAGE_NAME}:${VERSION}" "${IMAGE_NAME}:latest" | gzip > /tmp/ouriva-image.tar.gz
IMAGE_SIZE=$(du -h /tmp/ouriva-image.tar.gz | cut -f1)
echo "      Image saved (${IMAGE_SIZE})."
echo ""

# ----------------------------------------------------------
# Step 5: Transfer to the Raspberry Pi
# ----------------------------------------------------------
echo "[5/7] Transferring image to Raspberry Pi..."
scp /tmp/ouriva-image.tar.gz "${PI_SSH}:/tmp/ouriva-image.tar.gz"
echo "      Transfer complete."
echo ""

# ----------------------------------------------------------
# Step 6: Load image and restart on the Pi
# ----------------------------------------------------------
echo "[6/7] Loading image and restarting app on Pi..."
ssh "${PI_SSH}" bash -s << REMOTE_COMMANDS
  echo "      Loading Docker image..."
  docker load < /tmp/ouriva-image.tar.gz
  rm /tmp/ouriva-image.tar.gz

  echo "      Restarting app..."
  cd "${PI_APP_DIR}" && docker compose up -d
  echo "      Done."
REMOTE_COMMANDS

# Clean up local temp file
rm /tmp/ouriva-image.tar.gz

# ----------------------------------------------------------
# Step 7: Verify
# ----------------------------------------------------------
echo ""
echo "[7/7] Verifying deployment..."
sleep 3
ssh "${PI_SSH}" "docker ps --filter name=ouriva --format 'table {{.Image}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo "=== Deploy complete! Version: ${VERSION} ==="
