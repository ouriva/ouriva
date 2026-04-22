// Resolve Exchange Rate for Transactions
// =======================================
// Shared helper used by both POST /api/transactions and PUT /api/transactions/[id].
//
// Logic:
//   1. Look up the account's currency and the app's default currency.
//   2. If they're the same (or no default currency), return null fields.
//   3. If the user supplied an explicit rate, use it.
//   4. If the user sent null, clear the rate.
//   5. Otherwise, auto-fetch the historical ECB rate from Frankfurter for the
//      transaction date (nearest available trading day).

import { prisma } from "@/lib/prisma";
import { getDefaultCurrency } from "@/lib/default-currency";
import { fetchExchangeRate, applyExchangeRate } from "@/lib/exchange-rate";

export async function resolveExchangeRateFields(
  fromAccountId: string,
  amount: number,
  date: Date,
  explicitRate: number | null | undefined
): Promise<{ exchangeRate: number | null; baseCurrencyAmount: number | null }> {
  const [account, defaultCurrency] = await Promise.all([
    prisma.account.findUnique({
      where: { id: fromAccountId },
      select: { currency: { select: { code: true } } },
    }),
    getDefaultCurrency(),
  ]);

  const defaultCode = defaultCurrency?.code ?? null;
  const accountCode = account?.currency?.code ?? null;

  // Feature off (no currencies in the system) or already in default currency
  if (!defaultCode || !accountCode || accountCode === defaultCode) {
    return { exchangeRate: null, baseCurrencyAmount: null };
  }

  // User explicitly cleared the rate
  if (explicitRate === null) {
    return { exchangeRate: null, baseCurrencyAmount: null };
  }

  const rate = explicitRate ?? await fetchExchangeRate(date, accountCode, defaultCode);

  return {
    exchangeRate: rate,
    baseCurrencyAmount: applyExchangeRate(amount, rate),
  };
}
