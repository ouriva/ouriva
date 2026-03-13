// API: GET /api/accounts/balances
// ================================
// Returns computed balances for all active accounts.
//
// Balance formula per account:
//   initialBalance
//   + SUM(amount) where type = INCOME and fromAccountId = account
//   - SUM(amount) where type = EXPENSE and fromAccountId = account
//
// Why compute instead of store?
// Storing a "balance" column would require updating it on every
// transaction create/edit/delete — and if any update is missed,
// the balance drifts (becomes wrong). Computing from transactions
// is always correct, and the performance cost is negligible for
// personal finance volumes (thousands of transactions, not millions).
//
// We use Prisma queries + JS aggregation rather than raw SQL because
// it's simpler and avoids driver adapter complexities with $queryRaw.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultCurrency } from "@/lib/default-currency";
import { fetchTodayRate } from "@/lib/exchange-rate";

export async function GET() {
  try {
    const [defaultCurrency, accounts, transactions] = await Promise.all([
      getDefaultCurrency(),
      prisma.account.findMany({
        where: { isActive: true },
        include: { currency: true, accountType: true },
        orderBy: { name: "asc" },
      }),
      prisma.transaction.findMany({
        where: {
          // Exclude split children — the parent transaction already holds
          // the full amount, so counting children too would double-count.
          parentTransactionId: null,
        },
        select: {
          type: true,
          amount: true,
          fromAccountId: true,
        },
      }),
    ]);

    // Build a balance map: accountId → running balance
    const balanceMap = new Map<string, number>();

    // Start with initial balances
    for (const account of accounts) {
      balanceMap.set(account.id, Number(account.initialBalance));
    }

    // Apply each transaction
    for (const tx of transactions) {
      const amount = Number(tx.amount);

      if (tx.type === "INCOME") {
        // Income goes INTO the fromAccount
        const current = balanceMap.get(tx.fromAccountId);
        if (current !== undefined) {
          balanceMap.set(tx.fromAccountId, current + amount);
        }
      } else if (tx.type === "EXPENSE") {
        // Expense goes OUT OF the fromAccount
        const current = balanceMap.get(tx.fromAccountId);
        if (current !== undefined) {
          balanceMap.set(tx.fromAccountId, current - amount);
        }
      }
    }

    // Build response: accounts with computed balances, grouped by currency
    const accountsWithBalances = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      balance: Math.round((balanceMap.get(account.id) || 0) * 100) / 100,
      currency: {
        id: account.currency.id,
        code: account.currency.code,
        symbol: account.currency.symbol,
      },
      accountType: {
        id: account.accountType.id,
        name: account.accountType.name,
      },
    }));

    // Group by currency for the dashboard display
    const byCurrency = new Map<
      string,
      { code: string; symbol: string; accounts: typeof accountsWithBalances; total: number }
    >();

    for (const account of accountsWithBalances) {
      const key = account.currency.code;
      if (!byCurrency.has(key)) {
        byCurrency.set(key, {
          code: account.currency.code,
          symbol: account.currency.symbol,
          accounts: [],
          total: 0,
        });
      }
      const group = byCurrency.get(key)!;
      group.accounts.push(account);
      group.total = Math.round((group.total + account.balance) * 100) / 100;
    }

    // Compute aggregated total in default currency using today's exchange rates.
    // Each currency group converts its total to the default currency.
    let aggregatedTotal: number | null = null;
    if (defaultCurrency) {
      const groups = Array.from(byCurrency.values());
      const converted = await Promise.all(
        groups.map(async (group) => {
          if (group.code === defaultCurrency.code) return group.total;
          try {
            const rate = await fetchTodayRate(group.code, defaultCurrency.code);
            return Math.round(group.total * rate * 100) / 100;
          } catch {
            // If rate fetch fails for a currency, skip it rather than crash
            return null;
          }
        })
      );
      aggregatedTotal = converted.reduce<number>(
        (sum, val) => (val !== null ? sum + val : sum),
        0
      );
      aggregatedTotal = Math.round(aggregatedTotal * 100) / 100;
    }

    return NextResponse.json({
      accounts: accountsWithBalances,
      byCurrency: Array.from(byCurrency.values()),
      aggregatedTotal,
      defaultCurrency: defaultCurrency
        ? { code: defaultCurrency.code, symbol: defaultCurrency.symbol }
        : null,
    });
  } catch (error) {
    console.error("GET /api/accounts/balances error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
