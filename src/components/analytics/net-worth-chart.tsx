"use client";

// Net Worth Chart
// ===============
// Card component showing the "Patrimônio Líquido" (net worth) over time.
// Fetches from /api/analytics/net-worth on mount and whenever the period
// changes. Renders a Recharts AreaChart with an amber gradient.
//
// Colors are set as explicit hex/hsl values — not CSS custom properties —
// because Recharts renders axis labels as SVG presentation attributes
// (fill="…") which do not process CSS custom properties. The theme is
// read via useTheme() to pick appropriate light/dark values.

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodSelector } from "@/components/analytics/period-selector";
import type { Period } from "@/components/analytics/period-selector";
import { formatCurrency, formatAmount } from "@/lib/formatters";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataPoint {
  date: string;
  netWorth: number;
}

interface NetWorthResponse {
  data: DataPoint[];
  currency: { code: string; symbol: string } | null;
  currentNetWorth: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Short date label for the x-axis, scaled to the selected period.
function formatXTick(dateStr: string, period: Period): string {
  try {
    const date = parseISO(dateStr);
    switch (period) {
      case "1m": return format(date, "d MMM");
      case "3m": return format(date, "d MMM");
      case "6m": return format(date, "MMM");
      case "1y": return format(date, "MMM");
      case "all": return format(date, "MMM yy");
    }
  } catch {
    return dateStr;
  }
}

// Compact y-axis labels: 1500 → "1.5k", 1200000 → "1.2M"
function formatYTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}

// Tooltip container uses a plain HTML div so CSS custom properties work.
const TOOLTIP_STYLE = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  fontSize: "12px",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NetWorthChart() {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [period, setPeriod] = useState<Period>("1y");
  const [response, setResponse] = useState<NetWorthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setIsLoading(true);
      setHasError(false);
      try {
        const res = await fetch(`/api/analytics/net-worth?period=${period}`);
        if (!res.ok) throw new Error("fetch failed");
        const json: NetWorthResponse = await res.json();
        if (!cancelled) setResponse(json);
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [period]);

  // Derived state
  const data = response?.data ?? [];
  const currency = response?.currency ?? null;
  const currentNetWorth = response?.currentNetWorth ?? null;

  const firstValue = data[0]?.netWorth ?? 0;
  const delta = currentNetWorth !== null ? currentNetWorth - firstValue : null;
  const deltaPercent =
    delta !== null && firstValue !== 0
      ? (delta / Math.abs(firstValue)) * 100
      : null;
  const isPositive = delta !== null && delta >= 0;

  // Axis colors must be explicit values — SVG fill= doesn't process CSS vars.
  const axisColor = isDark ? "hsl(240, 5%, 55%)" : "hsl(240, 5%, 45%)";
  const tickProps = { fontSize: 10, fill: axisColor };

  // Target ~6 visible x-axis labels regardless of data density.
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <Card>
      <CardHeader className="pb-2">
        {/* Chart label */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("netWorthLabel")}
        </p>

        {/* Hero value + delta */}
        {isLoading ? (
          <>
            <Skeleton className="mt-1 h-8 w-40" />
            <Skeleton className="mt-1 h-4 w-24" />
          </>
        ) : currentNetWorth !== null && currency ? (
          <div>
            <p className="text-3xl font-bold tabular-nums">
              {formatCurrency(currentNetWorth, currency.code, locale)}
            </p>
            {delta !== null && deltaPercent !== null && (
              <p
                className={cn(
                  "mt-0.5 text-xs font-semibold",
                  isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {isPositive ? "+" : "−"}
                {currency.symbol}
                {formatAmount(Math.abs(delta), locale)}{" "}
                ({isPositive ? "+" : ""}
                {deltaPercent.toFixed(1)}%)
              </p>
            )}
          </div>
        ) : !hasError ? (
          <p className="mt-1 text-sm text-muted-foreground">{t("noCurrency")}</p>
        ) : null}

        {/* Period selector */}
        <div className="mt-3">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-4">
        {isLoading && <Skeleton className="h-48 w-full rounded-lg" />}

        {hasError && !isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("loadError")}
          </p>
        )}

        {!isLoading && !hasError && data.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("noData")}
          </p>
        )}

        {!isLoading && !hasError && data.length > 0 && (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={data}
              margin={{ top: 8, right: 0, bottom: 0, left: 8 }}
            >
              <defs>
                <linearGradient
                  id="netWorthGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => formatXTick(v, period)}
                tick={tickProps}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
              />
              <YAxis
                orientation="right"
                tick={tickProps}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={formatYTick}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(
                  value:
                    | number
                    | string
                    | (number | string)[]
                    | readonly (string | number)[]
                    | undefined
                ) =>
                  [
                    currency && typeof value === "number"
                      ? formatCurrency(value, currency.code, locale)
                      : String(value ?? ""),
                    t("netWorthLabel"),
                  ] as [string, string]
                }
                labelFormatter={(label: string) => {
                  try {
                    return format(parseISO(label), "d MMM yyyy");
                  } catch {
                    return label;
                  }
                }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#netWorthGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#f59e0b" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
