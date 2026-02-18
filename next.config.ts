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
};

export default withSerwist(nextConfig);
