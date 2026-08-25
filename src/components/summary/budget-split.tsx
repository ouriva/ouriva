"use client";

// Budget Split — Configurable Needs/Wants/Savings View
// ======================================================
// Displays actual spending across the three Budget Split buckets (Needs,
// Wants, Savings) compared against configurable target percentages —
// defaulting to the classic 50/30/20 rule, but editable in Settings >
// General.
//
// Income is used as the 100% denominator — consistent with how the
// underlying rule is defined (applied to net/after-tax income).
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

interface BudgetSplitTargets {
  NEEDS: number;
  WANTS: number;
  SAVINGS: number;
}

interface BudgetSplitProps {
  breakdown: BucketBreakdown;
  totalIncome: number;
  targets: BudgetSplitTargets;
}

type BucketStatus = "good" | "warn" | "bad";

// Needs/Wants: the target is a ceiling — lower is better. Good up to the
// target, warn within 10 percentage points over, bad beyond that.
function makeCeilingStatusFn(target: number) {
  return (pct: number): BucketStatus => {
    if (pct <= target) return "good";
    if (pct <= target + 10) return "warn";
    return "bad";
  };
}

// Savings: the target is a floor — higher is better. Good at/above the
// target, warn within 10 percentage points under, bad beyond that.
function makeFloorStatusFn(target: number) {
  return (pct: number): BucketStatus => {
    if (pct >= target) return "good";
    if (pct >= target - 10) return "warn";
    return "bad";
  };
}

function buildBucketConfig(targets: BudgetSplitTargets) {
  return [
    {
      key: "NEEDS" as const,
      target: targets.NEEDS,
      color: "bg-needs-bar",
      textColor: "text-needs",
      bgColor: "bg-needs-tint",
      borderColor: "border-needs-border",
      statusFn: makeCeilingStatusFn(targets.NEEDS),
    },
    {
      key: "WANTS" as const,
      target: targets.WANTS,
      color: "bg-wants-bar",
      textColor: "text-wants",
      bgColor: "bg-wants-tint",
      borderColor: "border-wants-border",
      statusFn: makeCeilingStatusFn(targets.WANTS),
    },
    {
      key: "SAVINGS" as const,
      target: targets.SAVINGS,
      color: "bg-positive-bar",
      textColor: "text-positive",
      bgColor: "bg-positive-tint",
      borderColor: "border-positive-border",
      statusFn: makeFloorStatusFn(targets.SAVINGS),
    },
  ] as const;
}

const STATUS_CLASSES = {
  good: "text-positive",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};

export function BudgetSplit({ breakdown, totalIncome, targets }: Readonly<BudgetSplitProps>) {
  const t = useTranslations("summary");
  const locale = useLocale();

  const STATUS_LABELS = {
    good: t("statusOnTrack"),
    warn: t("statusReview"),
    bad: t("statusOffTrack"),
  };

  const BUCKETS = buildBucketConfig(targets).map((b) => {
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
              className="bg-needs-bar transition-all"
              style={{ width: `${needsPct}%` }}
            />
          )}
          {wantsPct > 0 && (
            <div
              className="bg-wants-bar transition-all"
              style={{ width: `${wantsPct}%` }}
            />
          )}
          {savingsPct > 0 && (
            <div
              className="bg-positive-bar transition-all"
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
            above, positioned at the configured targets (not fixed 50/80/100)
            so the cumulative split reads at a glance without relying on the
            hover-only title tooltip. */}
        <div className="relative mt-1 h-2">
          <div
            className="absolute top-0 h-2 w-px bg-needs-bar opacity-60"
            style={{ left: `${targets.NEEDS}%` }}
            title={t("budgetSplitNeedsTarget", { pct: targets.NEEDS })}
          />
          <div
            className="absolute top-0 h-2 w-px bg-wants-bar opacity-60"
            style={{ left: `${targets.NEEDS + targets.WANTS}%` }}
            title={t("budgetSplitWantsTarget", { pct: targets.WANTS, cumulative: targets.NEEDS + targets.WANTS })}
          />
          <div
            className="absolute top-0 h-2 w-px bg-positive-bar opacity-60"
            style={{ left: "100%" }}
            title={t("budgetSplitSavingsTarget", { pct: targets.SAVINGS, cumulative: 100 })}
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
