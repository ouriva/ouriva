// i18n Routing Configuration
// ===========================
// Defines supported locales and routing strategy.
//
// `localePrefix: "never"` means URLs never get a /en/ or /pt/ prefix —
// /dashboard stays /dashboard regardless of the active language.
// The active locale is read from the NEXT_LOCALE cookie instead.
// This is essential for the PWA: changing language must not break any
// saved home screen shortcuts or bookmarks.

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pt"],
  defaultLocale: "en",
  localePrefix: "never",  // no /en/ or /pt/ prefix in URLs
  // true = use the default cookie name ("NEXT_LOCALE"), which is also what
  // next-intl's middleware writes when the locale changes.
  localeCookie: true,
});
