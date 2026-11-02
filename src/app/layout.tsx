import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConfirmProvider } from "@/components/providers/confirm-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

// Geist is self-hosted (src/app/fonts, SIL OFL 1.1 — see OFL.txt) so builds
// never need to reach Google Fonts. The files are Google's "latin" subset
// (U+0000-00FF + common punctuation/€), variable across weights 100–900.
const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Ouriva",
    template: "%s | Ouriva",
  },
  description: "Personal budget tracking with multi-currency support",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ouriva",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/ouriva_transparent_32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/ouriva_transparent_192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/ouriva_background_180.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the active locale and message bundle on the server.
  // getLocale() reads the NEXT_LOCALE cookie (set by the middleware and
  // updated by the language picker in Settings). getMessages() loads the
  // correct JSON file from /messages/{locale}.json.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* NextIntlClientProvider makes the message bundle available to
            all Client Components via useTranslations(). Server Components
            use getTranslations() directly and do not need this provider. */}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
