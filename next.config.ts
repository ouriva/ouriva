// Next.js Configuration
// =====================
// This file configures both Next.js and the Serwist PWA plugin.
//
// withSerwistInit is a higher-order function: it takes Serwist
// options and returns a wrapper that enhances the Next.js config.
// During build, it compiles the service worker source file (swSrc)
// into the public directory (swDest) and injects a precache manifest
// listing all built assets for offline caching.
//
// The `disable` flag turns off the service worker in development
// so it doesn't interfere with hot module replacement (HMR).

import { spawnSync } from "node:child_process";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

// Use git commit hash as a revision identifier for precache entries.
// This ensures the offline page cache busts when the app is redeployed.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ??
  crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",       // where we write the service worker logic
  swDest: "public/sw.js",        // where the compiled SW goes (served at /sw.js)
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  disable: process.env.NODE_ENV === "development", // no SW in dev mode
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  // read-excel-file/node pulls in unzipper, which has an optional
  // @aws-sdk/client-s3 peer dep that webpack can't resolve at build
  // time. Marking it external tells Next.js to skip bundling it and
  // let Node.js require it at runtime — correct for a server-only lib.
  serverExternalPackages: ["read-excel-file"],
  // Silence the "webpack config with no turbopack config" error.
  // Serwist injects a webpack config for building the service worker,
  // but dev mode uses Turbopack (where Serwist is disabled anyway).
  turbopack: {},
  // "standalone" traces only the files the server needs and copies
  // them into .next/standalone. This produces a ~20MB self-contained
  // server instead of requiring the full node_modules (~300MB+).
  // Essential for small Docker images, especially on a Raspberry Pi.
  output: "standalone",
};

// next-intl plugin wires up the server-side request config so that
// getTranslations() / getLocale() work in Server Components and API
// routes without any per-call configuration.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(withSerwist(nextConfig));
