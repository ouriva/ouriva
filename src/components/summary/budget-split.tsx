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

import { cn } from "@/lib/utils";
import Link from "next/link";

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

const BUCKETS = [
  {
    key: "NEEDS" as const,
    label: "Needs",
    target: 50,
    color: "bg-blue-500",
    textColor: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    // Needs: lower is better — you want to stay under 50%
    statusFn: (pct: number) =>
      pct <= 50 ? "good" : pct <= 60 ? "warn" : "bad",
  },
  {
    key: "WANTS" as const,
    label: "Wants",
    target: 30,
    color: "bg-amber-500",
    textColor: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    // Wants: lower is better — you want to stay under 30%
    statusFn: (pct: number) =>
      pct <= 30 ? "good" : pct <= 40 ? "warn" : "bad",
  },
  {
    key: "SAVINGS" as const,
    label: "Savings",
    target: 20,
    color: "bg-green-500",
    textColor: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    // Savings: higher is better — you want to reach at least 20%
    statusFn: (pct: number) =>
      pct >= 20 ? "good" : pct >= 10 ? "warn" : "bad",
  },
] as const;

const STATUS_CLASSES = {
  good: "text-green-600 dark:text-green-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};

const STATUS_LABELS = {
  good: "On track",
  warn: "Review",
  bad: "Off track",
};

export function BudgetSplit({ breakdown, totalIncome }: BudgetSplitProps) {
  if (totalIncome === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No income recorded for this period
      </div>
    );
  }

  const pct = (amount: number) =>
    Math.round((amount / totalIncome) * 1000) / 10; // one decimal

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
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100% of income</span>
        </div>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
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
              className="bg-green-500 transition-all"
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
        {/* Target markers */}
        <div className="relative mt-1 h-2">
          <div
            className="absolute top-0 h-2 w-px bg-blue-400 opacity-60"
            style={{ left: "50%" }}
            title="Needs target: 50%"
          />
          <div
            className="absolute top-0 h-2 w-px bg-amber-400 opacity-60"
            style={{ left: "80%" }}
            title="Wants target: 30% → 80% cumulative"
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
                    €{amount.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-semibold", STATUS_CLASSES[status])}>
                    {STATUS_LABELS[status]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Target: {bucket.target}%
                  </p>
                </div>
              </div>

              {/* Progress bar within the card */}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{actualPct.toFixed(1)}% of income</span>
                  <span className={cn("font-medium", STATUS_CLASSES[status])}>
                    {diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : "Exact"}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-all", bucket.color)}
                    style={{ width: `${Math.min(actualPct / bucket.target, 2) * 50}%` }}
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
          €{breakdown.unclassified.toFixed(2)} in expenses ({pct(breakdown.unclassified).toFixed(1)}%) has no bucket assigned.{" "}
          <Link href="/settings/categories" className="underline underline-offset-2">
            Assign buckets in Settings › Categories
          </Link>
          .
        </div>
      )}
    </div>
  );
}
