// App Shell Layout
// ================
// This is a ROUTE GROUP layout. The "(app)" folder name with
// parentheses means:
//   - It DOES wrap all child pages with this layout
//   - It does NOT add "(app)" to the URL
//   - /dashboard, /transactions, etc. all get this layout
//
// Purpose: Add the bottom navigation bar and main content area
// to all app pages, while the root layout handles <html>, <body>,
// and providers.
//
// The `pb-20` (padding-bottom: 5rem) ensures page content doesn't
// get hidden behind the fixed bottom nav bar.

import { BottomNav } from "@/components/layout/bottom-nav";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background">
      {/* Main content area with padding for the bottom nav */}
      <main className="px-4 py-6 pb-20">{children}</main>

      {/* Fixed bottom navigation */}
      <BottomNav />
    </div>
  );
}
