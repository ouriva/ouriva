#!/usr/bin/env bash

# ============================================================
# Budget Tracker — Deploy Script
# ============================================================
# Builds the Docker image on your Mac, runs production database
# migrations, transfers the image to the Raspberry Pi, and
# restarts the app.
#
# Usage:
#   ./scripts/deploy.sh
#
# Prerequisites:
#   - Docker Desktop running on your Mac
#   - SSH access to both the DB server and the Raspberry Pi
#   - Production database already set up (database-production.sql)
#   - SSH tunnel to DB server running (for migrations)
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
# CONFIGURATION — Update these values for your environment
# ============================================================

# Docker image name and tag
IMAGE_NAME="budget-tracker"
IMAGE_TAG="latest"

# Raspberry Pi SSH connection (matches your ~/.ssh/config entry)
PI_SSH="raspberry-pi"
# Directory on the Pi where docker-compose.yml lives
PI_APP_DIR="~/budget-tracker"

# Database server SSH connection (for migrations)
DB_SSH="ubuntu-server_homelab"
# Production database connection for migrations
# This uses homelab_admin (your DB admin) because migrations
# need DDL privileges (CREATE TABLE, ALTER TABLE, etc.)
# The SSH tunnel maps localhost:5433 → DB server:5432
# (port 5433 to avoid conflict with the dev tunnel on 5432)
MIGRATE_DB_URL="postgresql://homelab_admin:YOUR_ADMIN_PASSWORD@localhost:5433/personal_finance"

# ============================================================
# SCRIPT START
# ============================================================

echo "=== Budget Tracker Deploy ==="
echo ""

# ----------------------------------------------------------
# Step 1: Build the Docker image on your Mac
# ----------------------------------------------------------
echo "[1/5] Building Docker image..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .
echo "      Done."
echo ""

# ----------------------------------------------------------
# Step 2: Run production database migrations
# ----------------------------------------------------------
echo "[2/5] Running production database migrations..."
echo "      Starting SSH tunnel to DB server (port 5433)..."

# Start an SSH tunnel in the background for migrations.
# We use port 5433 so it doesn't conflict with your dev tunnel on 5432.
ssh -f -N -L 5433:localhost:5432 "${DB_SSH}"
TUNNEL_PID=$!

# Give the tunnel a moment to establish
sleep 2

# Run migrations using homelab_admin (has DDL privileges)
DATABASE_URL="${MIGRATE_DB_URL}" npx prisma migrate deploy

# Close the SSH tunnel
kill "${TUNNEL_PID}" 2>/dev/null || true
echo "      Migrations applied."
echo ""

# ----------------------------------------------------------
# Step 3: Export the image to a compressed file
# ----------------------------------------------------------
echo "[3/5] Exporting Docker image..."
# docker save outputs a tar archive of the image layers.
# Piping through gzip compresses it (~150MB → ~60MB typically).
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > /tmp/budget-tracker-image.tar.gz
IMAGE_SIZE=$(du -h /tmp/budget-tracker-image.tar.gz | cut -f1)
echo "      Image saved (${IMAGE_SIZE})."
echo ""

# ----------------------------------------------------------
# Step 4: Transfer to the Raspberry Pi
# ----------------------------------------------------------
echo "[4/5] Transferring image to Raspberry Pi..."
# scp copies the file over SSH. The -C flag enables compression
# during transfer (though the file is already gzipped).
scp /tmp/budget-tracker-image.tar.gz "${PI_SSH}:/tmp/budget-tracker-image.tar.gz"
echo "      Transfer complete."
echo ""

# ----------------------------------------------------------
# Step 5: Load image and restart on the Pi
# ----------------------------------------------------------
echo "[5/5] Loading image and restarting app on Pi..."
# Run commands on the Pi via SSH:
#   1. Load the Docker image from the transferred file
#   2. Remove the temp file
#   3. Restart the app with docker compose
ssh "${PI_SSH}" << 'REMOTE_COMMANDS'
  echo "      Loading Docker image..."
  docker load < /tmp/budget-tracker-image.tar.gz
  rm /tmp/budget-tracker-image.tar.gz

  echo "      Restarting app..."
  cd ~/budget-tracker
  docker compose up -d
  echo "      Done."
REMOTE_COMMANDS

# Clean up local temp file
rm /tmp/budget-tracker-image.tar.gz

echo ""
echo "=== Deploy complete! ==="
echo "    App should be running at http://<raspberry-pi-ip>:3000"
