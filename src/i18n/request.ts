// i18n Server-Side Request Config
// ================================
// Called by next-intl on every server render to determine the active locale
// and load the corresponding message bundle.
//
// Rather than relying on headers set by the proxy, we read the NEXT_LOCALE
// cookie directly via next/headers. This is more resilient — it works even
// on first visit (no cookie yet → falls back to "en") and when the proxy
// hasn't had a chance to set headers.

import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  // Validate: only accept known locales; fall back to "en" for anything else.
  const locale =
    cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale)
      ? cookieLocale
      : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
