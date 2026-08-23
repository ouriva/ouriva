import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConfirmProvider } from "@/components/providers/confirm-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
