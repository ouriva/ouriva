// Formatters
// ==========
// Utility functions for displaying currency amounts and dates.
// Centralized here so every part of the app formats consistently.

import { format, parseISO } from "date-fns";

// Format a number as currency with the proper symbol and locale.
// Examples: formatCurrency(1234.50, "EUR", "€") → "€1,234.50"
export function formatCurrency(
  amount: number | string,
  currencyCode: string,
  _symbol?: string
): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  // Intl.NumberFormat is a built-in browser/Node API for locale-aware
  // number formatting. It handles thousands separators, decimal places,
  // and currency symbol placement automatically.
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

// Format a date for display. Accepts Date objects or ISO strings.
// Default format: "Jan 15, 2026"
export function formatDate(
  date: Date | string,
  pattern: string = "MMM d, yyyy"
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return format(dateObj, pattern);
}

// Format a date for grouping (used in transaction list headers).
// Example: "January 2026"
export function formatMonthYear(date: Date | string): string {
  return formatDate(date, "MMMM yyyy");
}
