// Formatters
// ==========
// Utility functions for displaying currency amounts and dates.
// Centralized here so every part of the app formats consistently.
//
// Both functions accept an optional `locale` parameter so the app can
// format numbers and dates according to the user's chosen language:
//   - "en"  → 1,234.56 (US convention: comma thousands, period decimal)
//   - "pt"  → 1.234,56 (European convention: period thousands, comma decimal)
//
// The locale defaults to "en-US" to preserve existing behaviour for all
// call sites that haven't been updated yet.

import { format, parseISO, type Locale } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";

// Map our i18n locale codes to date-fns locale objects.
const DATE_LOCALES: Record<string, Locale> = {
  en: enUS,
  pt: ptBR,
};

// Format a number as currency with the proper symbol and locale.
// Examples:
//   formatCurrency(1234.50, "EUR")         → "$1,234.50" (en-US, wrong symbol — use Intl)
//   formatCurrency(1234.50, "EUR", "en")   → "€1,234.50"
//   formatCurrency(1234.50, "EUR", "pt")   → "1.234,50 €"
export function formatCurrency(
  amount: number | string,
  currencyCode: string,
  locale = "en"
): string {
  const numAmount = typeof amount === "string" ? Number.parseFloat(amount) : amount;

  // Map our short locale codes to BCP 47 tags that Intl.NumberFormat expects.
  const intlLocale = locale === "pt" ? "pt-PT" : "en-US";

  // Intl.NumberFormat is a built-in browser/Node API for locale-aware
  // number formatting. It handles thousands separators, decimal places,
  // and currency symbol placement automatically.
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

// Format a date for display. Accepts Date objects or ISO strings.
// Default format: "Jan 15, 2026" (en) / "15 de jan. de 2026" (pt)
export function formatDate(
  date: Date | string,
  pattern: string = "MMM d, yyyy",
  locale = "en"
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (Number.isNaN(dateObj.getTime())) return typeof date === "string" ? date : "";
  return format(dateObj, pattern, { locale: DATE_LOCALES[locale] ?? enUS });
}

// Format a date for grouping (used in transaction list headers).
// Example: "January 2026" (en) / "janeiro de 2026" (pt)
export function formatMonthYear(date: Date | string, locale = "en"): string {
  return formatDate(date, "MMMM yyyy", locale);
}

// Format a plain number with locale-aware decimal and thousands separators,
// without a currency symbol. Use this when only the symbol string is available
// (not the ISO currency code) — prepend the symbol manually after calling this.
// Examples:
//   formatAmount(1234.56, "en") → "1,234.56"
//   formatAmount(1234.56, "pt") → "1.234,56"
export function formatAmount(amount: number | string, locale = "en"): string {
  const numAmount = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  const intlLocale = locale === "pt" ? "pt-PT" : "en-US";
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

// Format a percentage value with locale-aware decimal separator.
// Examples:
//   formatPercent(89.5, 1, "en") → "89.5"
//   formatPercent(89.5, 1, "pt") → "89,5"
//   formatPercent(75, 0, "en")   → "75"
export function formatPercent(value: number, decimals = 0, locale = "en"): string {
  const intlLocale = locale === "pt" ? "pt-PT" : "en-US";
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
