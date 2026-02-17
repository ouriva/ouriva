// Root Page — Redirect to Dashboard
// ==================================
// Next.js `redirect()` sends a 307 (temporary redirect) to the
// browser. This runs on the server, so the user never sees this
// page — they go straight to /dashboard.
//
// Why redirect instead of rendering Dashboard here?
// Because /dashboard lives inside the (app) route group which
// has the bottom nav layout. Rendering it here would skip that.

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
