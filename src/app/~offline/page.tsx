// Offline Fallback Page
// =====================
// Shown when the user navigates while offline. This page is
// precached by the service worker (see additionalPrecacheEntries
// in next.config.ts) so it's always available even without network.
//
// The ~offline route uses a tilde prefix — this is a Serwist
// convention. The tilde makes it unlikely to collide with real
// app routes.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">You're offline</h1>
      <p className="mt-2 text-muted-foreground">
        Check your internet connection and try again.
      </p>
    </div>
  );
}
