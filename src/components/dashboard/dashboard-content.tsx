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
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Landmark, Plus, TrendingUp } from "lucide-react";
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

interface NetWorthTrend {
  delta: number;
  deltaPercent: number | null;
  isPositive: boolean;
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
    color: "text-positive",
    bgColor: "bg-positive-tint",
    amountColor: "text-positive",
    sign: "+",
  },
  EXPENSE: {
    icon: ArrowUpRight,
    color: "text-danger",
    bgColor: "bg-danger-tint",
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

function RecentTransactionRow({ tx, isLast, locale }: Readonly<RecentTransactionRowProps>) {
  const config =
    tx.type === "TRANSFER"
      ? tx.category?.name === "Transfer In"
        ? TX_CONFIG.INCOME
        : TX_CONFIG.EXPENSE
      : (TX_CONFIG[tx.type as keyof typeof TX_CONFIG] ?? TX_CONFIG.EXPENSE);
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
          {formatAmount(Number.parseFloat(tx.amount), locale)}
        </span>
      </div>
    </Link>
  );
}

interface SpendingMeterProps {
  monthly: MonthlySummary;
  locale: string;
}

function SpendingMeter({ monthly, locale }: Readonly<SpendingMeterProps>) {
  const t = useTranslations("dashboard");
  const spentPct = monthly.totalIncome > 0
    ? (monthly.totalExpense / monthly.totalIncome) * 100
    : 0;
  let barColor: string;
  if (spentPct > 100) barColor = "bg-red-500";
  else if (spentPct > 80) barColor = "bg-amber-500";
  else barColor = "bg-positive-bar";
  const symbol = monthly.currencySymbol ?? "";

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("income")}</p>
            <p className="text-xl font-bold tabular-nums text-positive">
              {symbol}{formatAmount(monthly.totalIncome, locale)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("expenses")}</p>
            <p className="text-xl font-bold tabular-nums text-danger">
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
              <span className={cn("font-semibold", monthly.net >= 0 ? "text-positive" : "text-danger")}>
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

// ─── Data hook ───────────────────────────────────────────────────────────────

// Encapsulates all data fetching for the dashboard so DashboardContent
// only contains layout and rendering logic. Keeping the async work in a
// hook also makes the component easier to test in isolation.
function useDashboardData() {
  const [balancesData, setBalancesData] = useState<BalancesData | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>([]);
  const [netWorthTrend, setNetWorthTrend] = useState<NetWorthTrend | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setIsLoading(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const [balRes, monthRes, txRes, trendRes] = await Promise.all([
          fetch("/api/accounts/balances"),
          fetch(`/api/summary/monthly?year=${year}&month=${month}`),
          fetch("/api/transactions?limit=5"),
          fetch("/api/analytics/net-worth?period=1m"),
        ]);

        if (balRes.ok) setBalancesData(await balRes.json());
        if (monthRes.ok) setMonthly(await monthRes.json());
        if (txRes.ok) {
          const data = await txRes.json();
          setRecentTx(data.data);
        }
        if (trendRes.ok) {
          const trend: { data: { netWorth: number }[]; currentNetWorth: number | null } = await trendRes.json();
          const firstValue = trend.data[0]?.netWorth ?? 0;
          if (trend.currentNetWorth !== null && trend.data.length > 1) {
            const delta = trend.currentNetWorth - firstValue;
            setNetWorthTrend({
              delta,
              deltaPercent: firstValue !== 0 ? (delta / Math.abs(firstValue)) * 100 : null,
              isPositive: delta >= 0,
            });
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  return { balancesData, monthly, recentTx, netWorthTrend, isLoading };
}

// ─── Net Worth Hero ───────────────────────────────────────────────────────────
// Dark gradient card showing the aggregated net worth (or per-currency totals
// when no default currency is set). Extracted from DashboardContent to reduce
// cognitive complexity (S3776).

interface NetWorthHeroProps {
  balances: CurrencyGroup[];
  aggregatedTotal: number | null;
  defaultCurrency: { code: string; symbol: string } | null;
  trend: NetWorthTrend | null;
  locale: string;
}

function NetWorthHero({ balances, aggregatedTotal, defaultCurrency, trend, locale }: Readonly<NetWorthHeroProps>) {
  const t = useTranslations("dashboard");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-hero p-5 text-hero-foreground shadow-lg">
      {/* Decorative layers: a single restrained corner glow + a top hairline,
          in place of the old two-stop diagonal gradient. Plain inline style
          because these are gradients, not solid-color utilities. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 100% 0%, var(--hero-glow), transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--hero-hairline), transparent)" }}
      />

      <p className="relative text-[10px] font-semibold uppercase tracking-widest text-hero-muted">
        {t("netWorth")}
      </p>
      {aggregatedTotal !== null && defaultCurrency ? (
        <div className="relative mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">
              {defaultCurrency.symbol}{formatAmount(aggregatedTotal, locale)}
            </span>
            <span className="text-sm text-hero-muted">{defaultCurrency.code}</span>
          </div>
          {trend && (
            <p className={cn("mt-1 text-xs font-semibold", trend.isPositive ? "text-hero-positive" : "text-hero-danger")}>
              {trend.isPositive ? "▲" : "▼"} {defaultCurrency.symbol}{formatAmount(Math.abs(trend.delta), locale)}
              {trend.deltaPercent !== null && ` (${formatPercent(Math.abs(trend.deltaPercent), 1, locale)})`}
              {" "}{t("trendThisMonth")}
            </p>
          )}
          {/* Per-currency breakdown shown as translucent chips when more than one currency */}
          {balances.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {balances.map((group) => (
                <span key={group.code} className="rounded-lg bg-hero-chip px-2 py-1.5 text-xs tabular-nums text-hero-chip-foreground">
                  {formatCurrency(group.total, group.code, locale)} {group.code}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Single currency or no default set — show each currency on its own line
        <div className="relative mt-2 space-y-0.5">
          {balances.map((group) => (
            <div key={group.code} className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">
                {formatCurrency(group.total, group.code, locale)}
              </span>
              <span className="text-sm text-hero-muted">{group.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
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
  const { balancesData, monthly, recentTx, netWorthTrend, isLoading } = useDashboardData();

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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/analytics" aria-label={t("viewAnalytics")}>
              <TrendingUp className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/transactions/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("addTransaction")}
            </Link>
          </Button>
        </div>
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
      {isLoading && <Skeleton className="h-28 w-full rounded-2xl" />}
      {!isLoading && balances.length > 0 && (
        <NetWorthHero
          balances={balances}
          aggregatedTotal={aggregatedTotal}
          defaultCurrency={defaultCurrency}
          trend={netWorthTrend}
          locale={locale}
        />
      )}

      {/* ── 3. Account Horizontal Scroll ─────────────────────────────────── */}
      {isLoading && (
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] w-36 flex-none rounded-xl" />
          ))}
        </div>
      )}
      {!isLoading && allAccounts.length > 0 && (
        // -mx-4 px-4: bleed the scroll strip to the screen edges while keeping
        // 16px padding so the first and last cards aren't clipped.
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
          {allAccounts.map((account) => (
            <Link
              key={account.id}
              href={`/transactions?accountId=${account.id}`}
              className="flex-none"
            >
              <div className="w-36 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-primary active:bg-muted">
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
            </Link>
          ))}
        </div>
      )}

      {/* ── 4. This Month Spending Meter ─────────────────────────────────── */}
      {isLoading && <Skeleton className="h-28 w-full rounded-xl" />}
      {!isLoading && monthly && (
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
      )}

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

        {isLoading && (
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
        )}
        {!isLoading && recentTx.length > 0 && (
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
        )}
        {!isLoading && recentTx.length === 0 && (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            {t("noTransactions")}
          </div>
        )}
      </section>
    </div>
  );
}
