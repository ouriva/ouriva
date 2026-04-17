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
# Each stage starts from a fresh base image. Only files explicitly
# copied with COPY --from=<stage> end up in the final image.
# This keeps the final image small (~150MB vs ~1GB+ with full
# node_modules and source code).
#
# The base image is node:22-alpine (Node.js LTS + Alpine Linux), pinned
# to a specific digest rather than a mutable tag. A supply chain attack
# on Docker Hub (e.g. the March 2026 Trivy compromise) that pushed a
# malicious image under the same tag would produce a different hash —
# the build would refuse to run, protecting the CI/CD environment.
# ============================================================

# ------------------------------------
# Stage 1: Install dependencies
# ------------------------------------
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS deps

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
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS builder

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
# Stage 3: Production runner
# ------------------------------------
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS runner

WORKDIR /app

# Upgrade npm to fix vulnerabilities in its bundled dependencies
# (brace-expansion ReDoS via minimatch, picomatch ReDoS via node-gyp).
# The npm version shipped with node:22-alpine contains these CVEs —
# upgrading npm replaces the bundled copies with patched versions.
# Pinned to a specific version for reproducible builds.
RUN npm install -g npm@11.6.4

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

# Start the standalone server
CMD ["node", "server.js"]
