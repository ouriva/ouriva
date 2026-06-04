// API: GET /api/analytics/net-worth?period=1m|3m|6m|1y|all
// ============================================================
// Returns an event-driven net worth time series: one data point per
// transaction date within the requested period, plus a start-of-period
// anchor so the chart always has a left edge.
//
// Computation approach:
//   1. Fetch all active accounts + all non-split transactions (ordered
//      by date asc).
//   2. Determine the start date from ?period. For "all", use the
//      earliest transaction date.
//   3. Collect unique transaction dates within [start, today] plus the
//      anchor date.
//   4. Single-pass through sorted transactions: maintain a running
//      balance per account, snapshot net worth at each target date.
//   5. Convert balances to default currency using today's FX rates
//      (fetched once upfront, not once per date).
//
// Why event-driven instead of day-by-day?
//   Net worth only changes on transaction dates. One point per
//   transaction date gives the same visual result as day-by-day with
//   far fewer data points — never wasteful even for "ALL" time ranges.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultCurrency } from "@/lib/default-currency";
import { fetchTodayRate } from "@/lib/exchange-rate";
import { subMonths, format } from "date-fns";

export type Period = "1m" | "3m" | "6m" | "1y" | "all";

const VALID_PERIODS: Period[] = ["1m", "3m", "6m", "1y", "all"];

function parsePeriod(raw: string | null): Period {
  if (raw && VALID_PERIODS.includes(raw as Period)) return raw as Period;
  return "1y";
}

function periodStartDate(period: Period, earliestTxDate: Date | null): Date {
  if (period === "all") return earliestTxDate ?? new Date();
  const months: Record<Exclude<Period, "all">, number> = {
    "1m": 1,
    "3m": 3,
    "6m": 6,
    "1y": 12,
  };
  return subMonths(new Date(), months[period]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = parsePeriod(searchParams.get("period"));

  try {
    const [defaultCurrency, accounts, allTransactions] = await Promise.all([
      getDefaultCurrency(),
      prisma.account.findMany({
        where: { isActive: true },
        include: { currency: true },
      }),
      prisma.transaction.findMany({
        where: { parentTransactionId: null },
        select: {
          type: true,
          amount: true,
          fromAccountId: true,
          date: true,
        },
        orderBy: { date: "asc" },
      }),
    ]);

    if (!defaultCurrency) {
      return NextResponse.json({
        data: [],
        currency: null,
        currentNetWorth: null,
      });
    }

    // Fetch today's FX rates once for all foreign-currency accounts.
    // fetchTodayRate uses a module-scope cache so duplicate pairs cost
    // nothing extra within the same request.
    const foreignCurrencyCodes = [
      ...new Set(
        accounts
          .filter((a) => a.currency.code !== defaultCurrency.code)
          .map((a) => a.currency.code)
      ),
    ];
    const rateMap = new Map<string, number>();
    rateMap.set(defaultCurrency.code, 1);
    await Promise.all(
      foreignCurrencyCodes.map(async (code) => {
        try {
          const rate = await fetchTodayRate(code, defaultCurrency.code);
          rateMap.set(code, rate);
        } catch {
          // Skip accounts in this currency if rate fetch fails — same
          // resilience pattern as /api/accounts/balances.
        }
      })
    );

    // Determine the period window.
    const earliestTxDate =
      allTransactions.length > 0 ? new Date(allTransactions[0].date) : null;
    const startDate = periodStartDate(period, earliestTxDate);
    const today = new Date();
    const startDateStr = format(startDate, "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");

    // Collect the sorted set of target dates:
    //   • Anchor: start-of-period (always present so the chart has a left edge)
    //   • One entry per transaction date within [start, today]
    const dateSet = new Set<string>();
    dateSet.add(startDateStr);
    for (const tx of allTransactions) {
      const txDateStr = format(new Date(tx.date), "yyyy-MM-dd");
      if (txDateStr >= startDateStr && txDateStr <= todayStr) {
        dateSet.add(txDateStr);
      }
    }
    const sortedDates = Array.from(dateSet).sort();

    // Single-pass: walk transactions once in date order, snapshot net
    // worth at each target date. We include ALL transactions (not just
    // those within the period) so the anchor reflects the correct
    // accumulated balance before the selected period begins.
    const runningBalance = new Map<string, number>(
      accounts.map((a) => [a.id, Number(a.initialBalance)])
    );
    let txIndex = 0;

    const data: { date: string; netWorth: number }[] = [];

    for (const dateStr of sortedDates) {
      // Apply every transaction whose date string ≤ dateStr.
      // String comparison on "yyyy-MM-dd" is lexicographically correct
      // for chronological ordering.
      while (txIndex < allTransactions.length) {
        const tx = allTransactions[txIndex];
        const txDateStr = format(new Date(tx.date), "yyyy-MM-dd");
        if (txDateStr > dateStr) break;

        const current = runningBalance.get(tx.fromAccountId) ?? 0;
        const amount = Number(tx.amount);
        if (tx.type === "INCOME") {
          runningBalance.set(tx.fromAccountId, current + amount);
        } else if (tx.type === "EXPENSE") {
          runningBalance.set(tx.fromAccountId, current - amount);
        }
        txIndex++;
      }

      // Sum all account balances converted to the default currency.
      let netWorth = 0;
      for (const account of accounts) {
        const balance = runningBalance.get(account.id) ?? 0;
        const rate = rateMap.get(account.currency.code);
        if (rate === undefined) continue;
        netWorth += balance * rate;
      }

      data.push({
        date: dateStr,
        netWorth: Math.round(netWorth * 100) / 100,
      });
    }

    const currentNetWorth =
      data.length > 0 ? data[data.length - 1].netWorth : null;

    return NextResponse.json({
      data,
      currency: {
        code: defaultCurrency.code,
        symbol: defaultCurrency.symbol,
      },
      currentNetWorth,
    });
  } catch (error) {
    console.error("GET /api/analytics/net-worth error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
