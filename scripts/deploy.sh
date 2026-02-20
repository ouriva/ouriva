#!/usr/bin/env bash

# ============================================================
# Budget Tracker — Deploy Script
# ============================================================
# Builds the Docker image on your Mac, runs production database
# migrations, transfers the image to the Raspberry Pi, and
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
#   3. Runs Prisma migrations against the production database
#   4. Exports the image to a compressed file
#   5. Transfers it to the Raspberry Pi via SSH
#   6. Loads the image and restarts the container on the Pi
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
for var in PI_SSH PI_APP_DIR DB_SSH MIGRATE_DB_URL; do
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

IMAGE_NAME="budget-tracker"
VERSION=$(git -C "${PROJECT_DIR}" describe --tags --abbrev=0 2>/dev/null || true)

if [ -z "${VERSION}" ]; then
  echo "Error: No git tag found."
  echo ""
  echo "Create a version tag first:"
  echo "  git tag v1.0.0"
  echo "  ./scripts/deploy.sh"
  exit 1
fi

# Check for uncommitted changes — deploying dirty state is risky
if [ -n "$(git -C "${PROJECT_DIR}" status --porcelain)" ]; then
  echo "Warning: You have uncommitted changes."
  read -p "Deploy anyway? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
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

echo "=== Budget Tracker Deploy — ${VERSION} ==="
echo ""

# ----------------------------------------------------------
# Step 1: Build the Docker image
# ----------------------------------------------------------
echo "[1/6] Building Docker image (${VERSION})..."
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
# Step 2: Run production database migrations
# ----------------------------------------------------------
echo "[2/6] Running production database migrations..."
echo "      Starting SSH tunnel to DB server (port 5433)..."

ssh -f -N -L 5433:localhost:5432 "${DB_SSH}"
TUNNEL_PID=$!
sleep 2

DATABASE_URL="${MIGRATE_DB_URL}" npx prisma migrate deploy --schema="${PROJECT_DIR}/prisma/schema.prisma"

kill "${TUNNEL_PID}" 2>/dev/null || true
echo "      Migrations applied."
echo ""

# ----------------------------------------------------------
# Step 3: Export the image to a compressed file
# ----------------------------------------------------------
echo "[3/6] Exporting Docker image..."
# Save both tags so the Pi has version + latest
docker save "${IMAGE_NAME}:${VERSION}" "${IMAGE_NAME}:latest" | gzip > /tmp/budget-tracker-image.tar.gz
IMAGE_SIZE=$(du -h /tmp/budget-tracker-image.tar.gz | cut -f1)
echo "      Image saved (${IMAGE_SIZE})."
echo ""

# ----------------------------------------------------------
# Step 4: Transfer to the Raspberry Pi
# ----------------------------------------------------------
echo "[4/6] Transferring image to Raspberry Pi..."
scp /tmp/budget-tracker-image.tar.gz "${PI_SSH}:/tmp/budget-tracker-image.tar.gz"
echo "      Transfer complete."
echo ""

# ----------------------------------------------------------
# Step 5: Load image and restart on the Pi
# ----------------------------------------------------------
echo "[5/6] Loading image and restarting app on Pi..."
ssh "${PI_SSH}" << REMOTE_COMMANDS
  echo "      Loading Docker image..."
  docker load < /tmp/budget-tracker-image.tar.gz
  rm /tmp/budget-tracker-image.tar.gz

  echo "      Restarting app..."
  cd ${PI_APP_DIR}
  docker compose up -d
  echo "      Done."
REMOTE_COMMANDS

# Clean up local temp file
rm /tmp/budget-tracker-image.tar.gz

# ----------------------------------------------------------
# Step 6: Verify
# ----------------------------------------------------------
echo ""
echo "[6/6] Verifying deployment..."
sleep 3
ssh "${PI_SSH}" "docker ps --filter name=budget-tracker --format 'table {{.Image}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo "=== Deploy complete! Version: ${VERSION} ==="
