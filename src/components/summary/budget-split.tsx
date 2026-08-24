"use client";

// Budget Split — 50/30/20 Rule View
// ===================================
// Displays actual spending across the three 50/30/20 buckets
// (Needs, Wants, Savings) compared against the target percentages.
//
// Income is used as the 100% denominator — consistent with how
// the 50/30/20 rule is defined (applied to net/after-tax income).
//
// Bucket inheritance: effective bucket = category.bucket ?? parent.bucket.
// This is resolved server-side; the component just consumes the totals.

import { useTranslations, useLocale } from "next-intl";
import { formatAmount, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface BucketBreakdown {
  NEEDS: number;
  WANTS: number;
  SAVINGS: number;
  unclassified: number;
}

interface BudgetSplitProps {
  breakdown: BucketBreakdown;
  totalIncome: number;
}

const BUCKET_CONFIG = [
  {
    key: "NEEDS" as const,
    target: 50,
    color: "bg-blue-500",
    textColor: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    // Needs: lower is better — you want to stay under 50%
    statusFn: (pct: number) => {
      if (pct <= 50) return "good";
      if (pct <= 60) return "warn";
      return "bad";
    },
  },
  {
    key: "WANTS" as const,
    target: 30,
    color: "bg-amber-500",
    textColor: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    // Wants: lower is better — you want to stay under 30%
    statusFn: (pct: number) => {
      if (pct <= 30) return "good";
      if (pct <= 40) return "warn";
      return "bad";
    },
  },
  {
    key: "SAVINGS" as const,
    target: 20,
    color: "bg-emerald-500",
    textColor: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    // Savings: higher is better — you want to reach at least 20%
    statusFn: (pct: number) => {
      if (pct >= 20) return "good";
      if (pct >= 10) return "warn";
      return "bad";
    },
  },
] as const;

const STATUS_CLASSES = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};

export function BudgetSplit({ breakdown, totalIncome }: Readonly<BudgetSplitProps>) {
  const t = useTranslations("summary");
  const locale = useLocale();

  const STATUS_LABELS = {
    good: t("statusOnTrack"),
    warn: t("statusReview"),
    bad: t("statusOffTrack"),
  };

  const BUCKETS = BUCKET_CONFIG.map((b) => {
    let labelKey: "needs" | "wants" | "savings";
    if (b.key === "NEEDS") labelKey = "needs";
    else if (b.key === "WANTS") labelKey = "wants";
    else labelKey = "savings";
    return { ...b, label: t(labelKey) };
  });

  if (totalIncome === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {t("noIncomeThisPeriod")}
      </div>
    );
  }

  const pct = (amount: number) =>
    Math.round((amount / totalIncome) * 1000) / 10; // one decimal

  // Total spent across all buckets — uncapped, used to detect overspending
  // that the capped stacked-bar segments below would otherwise hide.
  const totalSpent = breakdown.NEEDS + breakdown.WANTS + breakdown.SAVINGS + breakdown.unclassified;
  const totalPct = pct(totalSpent);
  const isOverIncome = totalPct > 100;

  // Stacked bar segments — each bucket as % of income, capped at 100% total
  const needsPct = Math.min(pct(breakdown.NEEDS), 100);
  const wantsPct = Math.min(pct(breakdown.WANTS), 100 - needsPct);
  const savingsPct = Math.min(pct(breakdown.SAVINGS), 100 - needsPct - wantsPct);
  const unclassifiedPct = Math.min(
    pct(breakdown.unclassified),
    100 - needsPct - wantsPct - savingsPct
  );

  return (
    <div className="space-y-6">
      {/* Stacked bar — visual proportion of income */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">{t("totalSpentLabel")}</span>
          <span
            className={cn(
              "font-semibold",
              isOverIncome ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
            )}
          >
            {isOverIncome
              ? t("totalOverIncome", {
                  pct: formatPercent(totalPct, 1, locale),
                  symbol: "€",
                  amount: formatAmount(totalSpent - totalIncome, locale),
                })
              : t("totalWithinIncome", { pct: formatPercent(totalPct, 1, locale) })}
          </span>
        </div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>{t("pctOfIncome", { pct: 100 })}</span>
        </div>
        <div
          className={cn(
            "flex h-4 w-full overflow-hidden rounded-full border",
            isOverIncome
              ? "border-red-300 bg-red-100 dark:border-red-800 dark:bg-red-950/40"
              : "border-transparent bg-muted"
          )}
        >
          {needsPct > 0 && (
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${needsPct}%` }}
            />
          )}
          {wantsPct > 0 && (
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${wantsPct}%` }}
            />
          )}
          {savingsPct > 0 && (
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${savingsPct}%` }}
            />
          )}
          {unclassifiedPct > 0 && (
            <div
              className="bg-muted-foreground/30 transition-all"
              style={{ width: `${unclassifiedPct}%` }}
            />
          )}
        </div>
        {/* Target markers — one per bucket, colour-matched to its segment
            above, so the cumulative 50/30/20 split reads at a glance
            without relying on the hover-only title tooltip. */}
        <div className="relative mt-1 h-2">
          <div
            className="absolute top-0 h-2 w-px bg-blue-400 opacity-60"
            style={{ left: "50%" }}
            title={t("budgetSplit50Target")}
          />
          <div
            className="absolute top-0 h-2 w-px bg-amber-400 opacity-60"
            style={{ left: "80%" }}
            title={t("budgetSplit30Target")}
          />
          <div
            className="absolute top-0 h-2 w-px bg-emerald-400 opacity-60"
            style={{ left: "100%" }}
            title={t("budgetSplit20Target")}
          />
        </div>
      </div>

      {/* Per-bucket rows */}
      <div className="space-y-3">
        {BUCKETS.map((bucket) => {
          const amount = breakdown[bucket.key];
          const actualPct = pct(amount);
          const status = bucket.statusFn(actualPct);
          const diff = actualPct - bucket.target;
          // Savings' target is a floor (higher is better), so "over" there
          // means falling short, not exceeding it — the opposite of Needs/Wants.
          const isOverTarget = bucket.key === "SAVINGS" ? diff < 0 : diff > 0;
          // Currency gap vs. the target amount — same "€X over" framing as
          // the top bar's total readout, just scoped to this one bucket.
          const targetAmount = (bucket.target / 100) * totalIncome;
          const amountGap = Math.abs(amount - targetAmount);

          return (
            <div
              key={bucket.key}
              className={cn(
                "rounded-lg border p-4",
                bucket.bgColor,
                bucket.borderColor
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn("text-sm font-semibold", bucket.textColor)}>
                    {bucket.label}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    €{formatAmount(amount, locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-semibold", STATUS_CLASSES[status])}>
                    {STATUS_LABELS[status]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("target", { pct: bucket.target })}
                  </p>
                </div>
              </div>

              {/* Progress bar within the card */}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{t("pctOfIncome", { pct: formatPercent(actualPct, 1, locale) })}</span>
                  <span className={cn("font-medium", STATUS_CLASSES[status])}>
                    {isOverTarget && bucket.key === "SAVINGS" &&
                      t("differenceUnderAmount", {
                        diff: formatPercent(Math.abs(diff), 1, locale),
                        symbol: "€",
                        amount: formatAmount(amountGap, locale),
                      })}
                    {isOverTarget && bucket.key !== "SAVINGS" &&
                      t("differenceOverAmount", {
                        diff: formatPercent(diff, 1, locale),
                        symbol: "€",
                        amount: formatAmount(amountGap, locale),
                      })}
                    {!isOverTarget && diff > 0 && t("differenceOver", { diff: formatPercent(diff, 1, locale) })}
                    {!isOverTarget && diff < 0 && t("differenceUnder", { diff: formatPercent(Math.abs(diff), 1, locale) })}
                    {diff === 0 && t("differenceExact")}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-all", isOverTarget ? "bg-red-500" : bucket.color)}
                    style={{ width: `${Math.min(actualPct / bucket.target, 1) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unclassified warning */}
      {breakdown.unclassified > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {t("unclassifiedWarning", {
            symbol: "€",
            amount: formatAmount(breakdown.unclassified, locale),
            pct: formatPercent(pct(breakdown.unclassified), 1, locale),
          })}
        </div>
      )}
    </div>
  );
}
