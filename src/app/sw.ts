// Service Worker
// ==============
// This file is compiled by Serwist and served at /sw.js.
// It runs in a separate thread from the main page (a Web Worker).
//
// Key concepts:
//   - Precaching: During build, Serwist generates a list of all
//     built assets (JS chunks, CSS, HTML) and injects it into
//     __SW_MANIFEST. The SW downloads and caches these on install.
//
//   - Runtime caching (defaultCache): Strategies for requests that
//     aren't precached — pages use network-first (fresh content
//     with cache fallback), static assets use cache-first (fast
//     with background updates).
//
//   - skipWaiting + clientsClaim: When a new SW is available,
//     activate it immediately instead of waiting for all tabs
//     to close. This ensures updates are applied quickly.
//
//   - Fallbacks: If a navigation request fails (user is offline),
//     serve the /~offline page instead of a browser error.

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// TypeScript: extend the worker's global scope with Serwist's
// injected manifest variable.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  // The precache manifest is injected at build time by the plugin
  precacheEntries: self.__SW_MANIFEST,
  // Activate the new service worker immediately
  skipWaiting: true,
  // Take control of all open tabs/windows right away
  clientsClaim: true,
  // Enable navigation preload for faster page loads
  navigationPreload: true,
  // Default caching strategies for different request types
  runtimeCaching: defaultCache,
  // Show a custom page when the user navigates while offline
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
