// PWA Manifest
// ============
// This file exports a MetadataRoute.Manifest object that Next.js
// serves at /manifest.json (or /manifest.webmanifest).
//
// The manifest tells the browser how to "install" the app:
//   - name / short_name: What appears on the home screen
//   - display: "standalone" = no browser address bar (looks native)
//   - start_url: Where the app opens when launched from home screen
//   - icons: App icons in various sizes
//   - theme_color: Status bar color on mobile
//   - background_color: Splash screen background while loading
//
// On iOS, users tap "Add to Home Screen" in Safari's share menu
// to install the PWA. Android shows an install prompt automatically
// when the manifest + service worker criteria are met.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ouriva",
    short_name: "Ouriva",
    description: "Personal budget tracking and expense management",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",  // matches zinc-950 (dark mode background)
    theme_color: "#09090b",
    icons: [
      {
        src: "/icons/ouriva_transparent_192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/ouriva_transparent_512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/ouriva_background_maskable_192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/ouriva_background_maskable_512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
