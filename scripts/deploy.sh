#!/usr/bin/env bash

# ============================================================
# Budget Tracker — Deploy Script
# ============================================================
# Builds the Docker image on your Mac, runs production database
# migrations, transfers the image to the Raspberry Pi, and
# restarts the app.
#
# Configuration is read from .env.production.local (gitignored).
# To set up, copy the example file and fill in your values:
#   cp .env.production.example .env.production.local
#
# Usage:
#   ./scripts/deploy.sh
#
# What this script does:
#   1. Builds the Docker image locally on your Mac
#   2. Runs Prisma migrations against the production database
#   3. Exports the image to a compressed file
#   4. Transfers it to the Raspberry Pi via SSH
#   5. Loads the image and restarts the container on the Pi
# ============================================================

set -euo pipefail  # Exit on any error, undefined variable, or pipe failure

# ============================================================
# Load configuration from .env.production.local
# ============================================================
# The script expects these variables to be defined:
#   PI_SSH         — SSH host for the Raspberry Pi
#   PI_APP_DIR     — Directory on the Pi where docker-compose.yml lives
#   DB_SSH         — SSH host for the database server
#   MIGRATE_DB_URL — Database URL for running migrations (admin user)

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

# source reads the file and exports the variables into this shell.
# set -a makes all variables automatically exported.
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

IMAGE_NAME="budget-tracker"
IMAGE_TAG="latest"

echo "=== Budget Tracker Deploy ==="
echo ""

# ----------------------------------------------------------
# Step 1: Build the Docker image on your Mac
# ----------------------------------------------------------
echo "[1/5] Building Docker image..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" "${PROJECT_DIR}"
echo "      Done."
echo ""

# ----------------------------------------------------------
# Step 2: Run production database migrations
# ----------------------------------------------------------
echo "[2/5] Running production database migrations..."
echo "      Starting SSH tunnel to DB server (port 5433)..."

# Start an SSH tunnel in the background for migrations.
# Port 5433 avoids conflict with your dev tunnel on 5432.
# -f = background, -N = no remote command, -L = port forward
ssh -f -N -L 5433:localhost:5432 "${DB_SSH}"
TUNNEL_PID=$!

# Give the tunnel a moment to establish
sleep 2

# Run migrations using homelab_admin (has DDL privileges).
# This overrides the .env file's DATABASE_URL for this command only.
DATABASE_URL="${MIGRATE_DB_URL}" npx prisma migrate deploy --schema="${PROJECT_DIR}/prisma/schema.prisma"

# Close the SSH tunnel
kill "${TUNNEL_PID}" 2>/dev/null || true
echo "      Migrations applied."
echo ""

# ----------------------------------------------------------
# Step 3: Export the image to a compressed file
# ----------------------------------------------------------
echo "[3/5] Exporting Docker image..."
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > /tmp/budget-tracker-image.tar.gz
IMAGE_SIZE=$(du -h /tmp/budget-tracker-image.tar.gz | cut -f1)
echo "      Image saved (${IMAGE_SIZE})."
echo ""

# ----------------------------------------------------------
# Step 4: Transfer to the Raspberry Pi
# ----------------------------------------------------------
echo "[4/5] Transferring image to Raspberry Pi..."
scp /tmp/budget-tracker-image.tar.gz "${PI_SSH}:/tmp/budget-tracker-image.tar.gz"
echo "      Transfer complete."
echo ""

# ----------------------------------------------------------
# Step 5: Load image and restart on the Pi
# ----------------------------------------------------------
echo "[5/5] Loading image and restarting app on Pi..."
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

echo ""
echo "=== Deploy complete! ==="
