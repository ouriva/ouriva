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
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Landmark, Plus } from "lucide-react";
import { CategoryIcon } from "@/components/ui/category-icon";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency, formatAmount, formatPercent } from "@/lib/formatters";

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

interface BalancesData {
  byCurrency: CurrencyGroup[];
  aggregatedTotal: number | null;
  defaultCurrency: { code: string; symbol: string } | null;
}

interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  net: number;
  currencySymbol: string | null;
}

interface RecentTransaction {
  id: string;
  type: string;
  amount: string;
  description: string | null;
  date: string;
  fromAccount: { name: string; currency: { symbol: string } };
  category: {
    name: string;
    icon: string | null;
    color: string | null;
    parent: { name: string } | null;
  } | null;
}

const TX_CONFIG = {
  INCOME: {
    icon: ArrowDownLeft,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    amountColor: "text-emerald-600 dark:text-emerald-400",
    sign: "+",
  },
  EXPENSE: {
    icon: ArrowUpRight,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    amountColor: "",
    sign: "−",
  },
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RecentTransactionRowProps {
  tx: RecentTransaction;
  isLast: boolean;
  locale: string;
}

function RecentTransactionRow({ tx, isLast, locale }: RecentTransactionRowProps) {
  const config = TX_CONFIG[tx.type as keyof typeof TX_CONFIG] ?? TX_CONFIG.EXPENSE;
  const categoryLabel = tx.category?.parent?.name ?? tx.category?.name ?? null;
  const description = tx.description ?? categoryLabel ?? (tx.type === "INCOME" ? "Income" : "Transaction");
  const subtext = [tx.fromAccount.name, formatTxDate(tx.date)].filter(Boolean).join(" · ");

  return (
    <Link href={`/transactions/${tx.id}`} className="block">
      <div className={cn("flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted", !isLast && "border-b")}>
        <CategoryIcon
          icon={tx.category?.icon}
          color={tx.category?.color}
          fallback={config.icon}
          fallbackBg={config.bgColor}
          fallbackColor={config.color}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{description}</p>
          <p className="truncate text-xs text-muted-foreground">{subtext}</p>
        </div>
        <span className={cn("text-sm font-semibold tabular-nums", config.amountColor)}>
          {config.sign}
          {tx.fromAccount.currency.symbol}
          {formatAmount(parseFloat(tx.amount), locale)}
        </span>
      </div>
    </Link>
  );
}

interface SpendingMeterProps {
  monthly: MonthlySummary;
  locale: string;
}

function SpendingMeter({ monthly, locale }: SpendingMeterProps) {
  const t = useTranslations("dashboard");
  const spentPct = monthly.totalIncome > 0
    ? (monthly.totalExpense / monthly.totalIncome) * 100
    : 0;
  const barColor = spentPct > 100 ? "bg-red-500" : spentPct > 80 ? "bg-amber-500" : "bg-emerald-500";
  const symbol = monthly.currencySymbol ?? "";

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("income")}</p>
            <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {symbol}{formatAmount(monthly.totalIncome, locale)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("expenses")}</p>
            <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {symbol}{formatAmount(monthly.totalExpense, locale)}
            </p>
          </div>
        </div>
        {monthly.totalIncome > 0 && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${Math.min(spentPct, 100)}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>{t("pctSpent", { pct: formatPercent(spentPct, 0, locale) })}</span>
              <span className={cn("font-semibold", monthly.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {monthly.net >= 0
                  ? t("saved", { symbol, amount: formatAmount(monthly.net, locale) })
                  : t("over", { symbol, amount: formatAmount(Math.abs(monthly.net), locale) })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodAfternoon";
  return "goodEvening";
}

function getMonthYear(locale: string): string {
  const intlLocale = locale === "pt" ? "pt-PT" : "en-US";
  const result = new Date().toLocaleDateString(intlLocale, { month: "long", year: "numeric" });
  // Portuguese (and some other locales) returns lowercase month names ("março de 2026").
  // Capitalise the first letter so it reads as a title ("Março de 2026").
  return result.charAt(0).toUpperCase() + result.slice(1);
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

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardContent() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [balancesData, setBalancesData] = useState<BalancesData | null>(null);
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

        if (balRes.ok) setBalancesData(await balRes.json());
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

  const balances = balancesData?.byCurrency ?? [];
  const aggregatedTotal = balancesData?.aggregatedTotal ?? null;
  const defaultCurrency = balancesData?.defaultCurrency ?? null;

  // Flatten all accounts across currency groups for the scroll strip
  const allAccounts = balances.flatMap((g) => g.accounts);

  return (
    <div className="space-y-5">

      {/* ── 1. Greeting ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t(getGreetingKey())}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{getMonthYear(locale)}</p>
            {!isLoading && monthly && monthly.net > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {t("onTrack")}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/transactions/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("addTransaction")}
          </Link>
        </Button>
      </div>

      {/* ── Empty state — shown when no accounts exist yet ───────────────── */}
      {!isLoading && balances.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Landmark className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="mx-auto mt-1.5 max-w-[260px] text-sm text-muted-foreground">
            {t("emptySubtitle")}
          </p>
          <Button className="mt-5" asChild>
            <Link href="/settings/accounts">{t("emptyAddAccount")}</Link>
          </Button>
        </div>
      )}

      {/* ── 2. Net Worth Hero ────────────────────────────────────────────── */}
      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-2xl" />
      ) : balances.length > 0 ? (
        <div className="rounded-2xl bg-gradient-to-br from-zinc-800 to-amber-950 p-5 text-white shadow-lg">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            {t("netWorth")}
          </p>
          {/* Aggregated total in default currency — shown when multi-currency */}
          {aggregatedTotal !== null && defaultCurrency ? (
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">
                  {defaultCurrency.symbol}{formatAmount(aggregatedTotal, locale)}
                </span>
                <span className="text-sm text-zinc-500">{defaultCurrency.code}</span>
              </div>
              {/* Per-currency breakdown shown as smaller secondary lines when more than one currency */}
              {balances.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
                  {balances.map((group) => (
                    <span key={group.code} className="text-xs text-zinc-400 tabular-nums">
                      {formatCurrency(group.total, group.code, locale)} {group.code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Single currency or no default set — show each currency on its own line
            <div className="mt-2 space-y-0.5">
              {balances.map((group) => (
                <div key={group.code} className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {formatCurrency(group.total, group.code, locale)}
                  </span>
                  <span className="text-sm text-zinc-500">{group.code}</span>
                </div>
              ))}
            </div>
          )}
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
                {account.name}
              </p>
              <p className="mt-1.5 truncate text-base font-bold tabular-nums">
                {formatCurrency(account.balance, account.currency.code, locale)}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {account.accountType.name}
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
            <h2 className="text-sm font-semibold">{t("thisMonth")}</h2>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
              <Link href="/summary">
                {t("details")} <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <SpendingMeter monthly={monthly} locale={locale} />
        </section>
      ) : null}

      {/* ── 5. Recent Transactions — compact list ────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("recent")}</h2>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
            <Link href="/transactions">
              {t("viewAll")} <ArrowRight className="h-3 w-3" />
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
              {recentTx.map((tx, i) => (
                <RecentTransactionRow
                  key={tx.id}
                  tx={tx}
                  isLast={i === recentTx.length - 1}
                  locale={locale}
                />
              ))}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            {t("noTransactions")}
          </div>
        )}
      </section>
    </div>
  );
}
