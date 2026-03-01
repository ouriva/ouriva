// Dashboard Content
// =================
// The main dashboard view. Fully client-side — fetches account balances,
// the current month's summary, and 5 recent transactions in parallel.
//
// Layout (mobile-first):
//   1. Greeting + quick-add button   — personalised, replaces generic page header
//   2. Net worth hero card           — dark gradient, highest visual weight
//   3. Account horizontal scroll     — one pill per account, swipe to see all
//   4. This Month spending meter     — income, progress bar, savings amount
//   5. Recent transactions           — compact list, colored avatar, date label
//
// Loading state uses skeleton placeholders matching each section's shape
// so the layout doesn't shift when data arrives.

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface AccountBalance {
  id: string;
  name: string;
  balance: number;
  currency: { code: string; symbol: string };
  accountType: { name: string };
}

interface CurrencyGroup {
  code: string;
  symbol: string;
  accounts: AccountBalance[];
  total: number;
}

interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  net: number;
}

interface RecentTransaction {
  id: string;
  type: string;
  amount: string;
  description: string | null;
  date: string;
  fromAccount: { name: string; currency: { symbol: string } };
  category: { name: string; parent: { name: string } | null } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getMonthYear(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Format a transaction date as "Today", "Yesterday", or "Mar 5"
function formatTxDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

// Deterministic color from a category name — maps to a Tailwind bg class.
// Uses a simple hash so the same category always gets the same color.
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
];

function categoryColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardContent() {
  const [balances, setBalances] = useState<CurrencyGroup[]>([]);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setIsLoading(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const [balRes, monthRes, txRes] = await Promise.all([
          fetch("/api/accounts/balances"),
          fetch(`/api/summary/monthly?year=${year}&month=${month}`),
          fetch("/api/transactions?limit=5"),
        ]);

        if (balRes.ok) {
          const data = await balRes.json();
          setBalances(data.byCurrency);
        }
        if (monthRes.ok) setMonthly(await monthRes.json());
        if (txRes.ok) {
          const data = await txRes.json();
          setRecentTx(data.data);
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Flatten all accounts across currency groups for the scroll strip
  const allAccounts = balances.flatMap((g) => g.accounts);

  // Spending meter derived values — safe when income is zero
  const spentPct =
    monthly && monthly.totalIncome > 0
      ? (monthly.totalExpense / monthly.totalIncome) * 100
      : 0;
  const barColor =
    spentPct > 100
      ? "bg-red-500"
      : spentPct > 80
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="space-y-5">

      {/* ── 1. Greeting ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{getGreeting()}</h1>
          <p className="text-sm text-muted-foreground">{getMonthYear()}</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/transactions/new">+ Add</Link>
        </Button>
      </div>

      {/* ── 2. Net Worth Hero ────────────────────────────────────────────── */}
      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-2xl" />
      ) : balances.length > 0 ? (
        <div className="rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 p-5 text-white shadow-lg">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            Net Worth
          </p>
          <div className="mt-2 space-y-0.5">
            {balances.map((group) => (
              <div key={group.code} className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">
                  {group.symbol}{group.total.toFixed(2)}
                </span>
                <span className="text-sm text-zinc-500">{group.code}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── 3. Account Horizontal Scroll ─────────────────────────────────── */}
      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] w-36 flex-none rounded-xl" />
          ))}
        </div>
      ) : allAccounts.length > 0 ? (
        // -mx-4 px-4: bleed the scroll strip to the screen edges while keeping
        // 16px padding so the first and last cards aren't clipped.
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
          {allAccounts.map((account) => (
            <div
              key={account.id}
              className="flex-none w-36 rounded-xl border bg-card p-3 shadow-sm"
            >
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {account.accountType.name}
              </p>
              <p className="mt-1.5 truncate text-base font-bold tabular-nums">
                {account.currency.symbol}{account.balance.toFixed(2)}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {account.name}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── 4. This Month Spending Meter ─────────────────────────────────── */}
      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : monthly ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">This Month</h2>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
              <Link href="/summary">
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <Card>
            <CardContent className="space-y-3 p-4">
              {/* Income / Expense row */}
              <div className="flex justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Income
                  </p>
                  <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    €{monthly.totalIncome.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Expenses
                  </p>
                  <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    €{monthly.totalExpense.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Spending progress bar (only shown when there's income to compare against) */}
              {monthly.totalIncome > 0 && (
                <div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", barColor)}
                      style={{ width: `${Math.min(spentPct, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>{spentPct.toFixed(0)}% spent</span>
                    <span
                      className={cn(
                        "font-semibold",
                        monthly.net >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {monthly.net >= 0
                        ? `+€${monthly.net.toFixed(2)} saved`
                        : `−€${Math.abs(monthly.net).toFixed(2)} over`}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* ── 5. Recent Transactions — compact list ────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent</h2>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
            <Link href="/transactions">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          // Skeleton rows that match the transaction list shape
          <Card>
            <CardContent className="space-y-4 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 flex-none rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : recentTx.length > 0 ? (
          <Card>
            {/* p-0 on CardContent so rows control their own padding */}
            <CardContent className="p-0">
              {recentTx.map((tx, i) => {
                const isIncome = tx.type === "INCOME";

                // Build a short label for the avatar and the subtext
                const categoryLabel = tx.category
                  ? tx.category.parent
                    ? tx.category.parent.name
                    : tx.category.name
                  : null;
                const avatarLabel = categoryLabel ?? (isIncome ? "Income" : "Other");
                const initial = avatarLabel[0].toUpperCase();
                const avatarBg = isIncome ? "bg-emerald-500" : categoryColor(avatarLabel);

                const description =
                  tx.description ?? categoryLabel ?? (isIncome ? "Income" : "Transaction");
                const subtext = [
                  tx.fromAccount.name,
                  formatTxDate(tx.date),
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <Link
                    href={`/transactions/${tx.id}`}
                    key={tx.id}
                    className="block"
                  >
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted",
                        i < recentTx.length - 1 && "border-b"
                      )}
                    >
                      {/* Colored avatar circle with category initial */}
                      <div
                        className={cn(
                          "flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white",
                          avatarBg
                        )}
                      >
                        {initial}
                      </div>

                      {/* Description + subtext */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{description}</p>
                        <p className="truncate text-xs text-muted-foreground">{subtext}</p>
                      </div>

                      {/* Amount */}
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          isIncome
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        )}
                      >
                        {isIncome ? "+" : "−"}
                        {tx.fromAccount.currency.symbol}
                        {parseFloat(tx.amount).toFixed(2)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            No transactions yet
          </div>
        )}
      </section>
    </div>
  );
}
