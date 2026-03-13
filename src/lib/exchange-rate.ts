// Exchange Rate Utility
// =====================
// Wraps the Frankfurter API (api.frankfurter.app) — free, no API key,
// European Central Bank data, ~33 currencies including EUR/USD/BRL.
//
// Design:
// - Module-level cache (Map) so bulk imports never hit the network twice
//   for the same date + pair within a single request lifecycle.
// - Frankfurter automatically returns the nearest available trading day
//   when a weekend or public holiday is requested. No fallback needed here.
// - fetchTodayRate uses "latest" endpoint for current dashboard aggregation.

const cache = new Map<string, number>();

/**
 * Fetch a historical exchange rate for a specific date.
 * Pass a Date or "YYYY-MM-DD" string.
 * Frankfurter falls back to the nearest available trading day automatically.
 *
 * @param date  Transaction date
 * @param from  Source currency code (e.g. "USD")
 * @param to    Target (default) currency code (e.g. "EUR")
 * @returns     Rate: 1 unit of `from` = N units of `to`
 */
export async function fetchExchangeRate(
  date: Date | string,
  from: string,
  to: string
): Promise<number> {
  if (from === to) return 1;

  const dateStr =
    typeof date === "string" ? date : date.toISOString().slice(0, 10);

  const cacheKey = `${dateStr}:${from}:${to}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const res = await fetch(
    `https://api.frankfurter.app/${dateStr}?from=${from}&to=${to}`
  );
  if (!res.ok) {
    throw new Error(
      `Frankfurter API error ${res.status} for ${dateStr} ${from}→${to}`
    );
  }

  const json = await res.json();
  const rate: number = json.rates?.[to];
  if (rate === undefined) {
    throw new Error(`No rate for ${to} in Frankfurter response on ${dateStr}`);
  }

  cache.set(cacheKey, rate);
  return rate;
}

/**
 * Fetch the latest (today's) exchange rate. Used for dashboard balance aggregation.
 */
export async function fetchTodayRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const cacheKey = `latest:${from}:${to}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const res = await fetch(
    `https://api.frankfurter.app/latest?from=${from}&to=${to}`
  );
  if (!res.ok) {
    throw new Error(`Frankfurter API error ${res.status} for latest ${from}→${to}`);
  }

  const json = await res.json();
  const rate: number = json.rates?.[to];
  if (rate === undefined) {
    throw new Error(`No rate for ${to} in Frankfurter latest response`);
  }

  cache.set(cacheKey, rate);
  return rate;
}

/**
 * Multiply amount by exchange rate, rounded to 4 decimal places.
 * Matches the DB column precision (Decimal(14,4)).
 */
export function applyExchangeRate(amount: number, rate: number): number {
  return Math.round(amount * rate * 10000) / 10000;
}
