# ============================================================
# Ouriva — Multi-stage Docker Build
# ============================================================
# This Dockerfile produces a minimal production image using
# Next.js standalone output mode.
#
# Multi-stage builds work like a pipeline:
#   Stage 1 (deps):    Install npm dependencies
#   Stage 2 (builder): Build the Next.js app
#   Stage 3 (runner):  Copy only the output into a clean image
#
# A separate "migrate" stage builds a small image that only runs
# Prisma migrations (docker build --target migrate). The default
# build, with no --target, is still the runner.
#
# Each stage starts from a fresh base image. Only files explicitly
# copied with COPY --from=<stage> end up in the final image.
# This keeps the final image small (~150MB vs ~1GB+ with full
# node_modules and source code).
#
# The base image is node:26-alpine (Node.js Current + Alpine Linux), pinned
# to a specific digest rather than a mutable tag. A supply chain attack
# on Docker Hub (e.g. the March 2026 Trivy compromise) that pushed a
# malicious image under the same tag would produce a different hash —
# the build would refuse to run, protecting the CI/CD environment.
# ============================================================

# ------------------------------------
# Stage 1: Install dependencies
# ------------------------------------
FROM node:26-alpine@sha256:a4fb14143ee24c038c851864fe85fd90f9121abc8fdca3092798bcc02e06b1d8 AS deps

# Set working directory inside the container
WORKDIR /app

# Copy only package files first. Docker caches each layer — if
# package.json hasn't changed, npm install is skipped on rebuild.
# This is called "layer caching" and speeds up repeated builds.
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies) because
# we need them for the build step (TypeScript, Prisma, etc.)
RUN npm ci

# ------------------------------------
# Stage 2: Build the application
# ------------------------------------
FROM node:26-alpine@sha256:a4fb14143ee24c038c851864fe85fd90f9121abc8fdca3092798bcc02e06b1d8 AS builder

WORKDIR /app

# Copy dependencies from the previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Generate Prisma client for the container's architecture.
# This is important because the Prisma client includes a
# platform-specific query engine binary. The one generated on
# your Mac (darwin-arm64) won't work inside the container
# (linux-arm64 or linux-amd64).
RUN npx prisma generate

# Build Next.js in standalone mode.
# The --webpack flag is needed because @serwist/next uses
# webpack hooks to compile the service worker.
RUN npm run build

# ------------------------------------
# Stage: Migrations only (built with --target migrate)
# ------------------------------------
# A small image that can only apply Prisma migrations, published
# next to the app image as ouriva-migrate. The app image (runner)
# has no npm/npx, so it can't run Prisma; the builder stage can,
# but it carries the full node_modules and source (~1GB) — too
# much to pull onto a small server for every release.
#
# Usage:
#   docker run --rm -e DATABASE_URL=... ouriva-migrate            # migrate deploy
#   docker run --rm -e DATABASE_URL=... ouriva-migrate migrate status
FROM node:26-alpine@sha256:a4fb14143ee24c038c851864fe85fd90f9121abc8fdca3092798bcc02e06b1d8 AS migrate

WORKDIR /app

# Install only the Prisma CLI and dotenv (prisma.config.ts imports
# it), at the exact versions package-lock.json pins, so migrations
# run with the same Prisma as the app. Installing inside Alpine
# also downloads the schema engine built for this platform.
COPY package-lock.json ./
RUN npm install --no-save --no-package-lock --no-audit --no-fund \
      "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
      "dotenv@$(node -p "require('./package-lock.json').packages['node_modules/dotenv'].version")" && \
    rm package-lock.json

# The schema, the migrations and the config that points at them
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations

# Run as the image's built-in unprivileged user
USER node

# The entrypoint is the Prisma CLI itself, so arguments are Prisma
# commands; with none, it applies pending migrations.
ENTRYPOINT ["node_modules/.bin/prisma"]
CMD ["migrate", "deploy"]

# ------------------------------------
# Stage 3: Production runner
# ------------------------------------
FROM node:26-alpine@sha256:a4fb14143ee24c038c851864fe85fd90f9121abc8fdca3092798bcc02e06b1d8 AS runner

WORKDIR /app

# Remove npm and npx — the production image only runs `node server.js`
# and never calls npm at runtime. Removing them eliminates the entire
# npm dependency tree (minimatch, brace-expansion, tar, picomatch, etc.)
# from the attack surface without affecting the running application.
# This is the "distroless by hand" approach: keep the Node runtime,
# strip everything not needed in production.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

# Run as non-root for security. If the app is compromised,
# the attacker has minimal system access.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone server output
# Next.js standalone includes a minimal node_modules with only
# the packages needed at runtime (not build tools, not TypeScript)
COPY --from=builder /app/.next/standalone ./

# Copy static assets (CSS, JS bundles, images)
# These aren't included in standalone and must be copied separately
COPY --from=builder /app/.next/static ./.next/static

# Copy public assets (icons, manifest, service worker)
COPY --from=builder /app/public ./public

# Switch to non-root user
USER nextjs

# Next.js standalone server listens on port 3000 by default
EXPOSE 3000

# HOSTNAME=0.0.0.0 makes the server listen on all interfaces,
# which is required inside Docker (otherwise it only listens
# on localhost which isn't reachable from outside the container)
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
ENV NODE_ENV=production

# Docker marks the container unhealthy after 3 failed probes in a row.
# /api/health runs SELECT 1, so the probe fails when the database is
# unreachable, not only when the Node process is down. BusyBox wget is
# part of Alpine; --spider requests without saving, and a non-2xx answer
# (503) makes it exit non-zero. Compose files can override this block.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

# Start the standalone server
CMD ["node", "server.js"]
