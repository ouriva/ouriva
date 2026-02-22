import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

// next/font/google downloads the font at build time and self-hosts it.
// No requests to Google's servers from your users' browsers.
// The `variable` option creates a CSS custom property we can reference.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata — Next.js reads this export and generates <head> tags.
// This is the App Router way of setting meta tags (replaces next/head).
export const metadata: Metadata = {
  title: {
    default: "Spendtinel",
    template: "%s | Spendtinel", // pages can set their own title: "Transactions" → "Transactions | Spendtinel"
  },
  description: "Personal budget tracking with multi-currency support",
  // PWA meta tags — tells iOS Safari to run in standalone mode (no browser chrome)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Spendtinel",
  },
  // Prevents phone numbers from being auto-linked on iOS
  formatDetection: {
    telephone: false,
  },
  // Icons — apple-touch-icon is used when adding to iPhone home screen
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

// Viewport is exported separately in Next.js 14+ (was part of metadata before).
// This prevents layout shifts and ensures proper mobile rendering.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,          // prevents pinch-to-zoom (better for app-like UX)
  userScalable: false,       // same — makes it feel like a native app
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is required by next-themes because it
    // modifies the <html> class attribute on the client (adding "dark"),
    // which differs from the server-rendered version. Without this,
    // React would warn about the mismatch.
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"       // adds "dark" class to <html> (vs data-theme attribute)
          defaultTheme="system"   // follow the user's OS preference by default
          enableSystem            // react to OS dark/light mode changes
          disableTransitionOnChange // prevents background color flash when switching themes
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
