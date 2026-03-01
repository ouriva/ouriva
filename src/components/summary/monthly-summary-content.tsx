// Monthly Summary Content
// =======================
// Fetches and displays the monthly summary. Fetches the selected month
// and the previous month in parallel so stat cards can show vs-last-month
// deltas without an extra round-trip.
//
// Loading state uses skeletons matching the actual layout shape.
// The pie chart has been removed — CategoryBreakdown now embeds the
// proportion visually as a progress bar per row.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthYearPicker } from "./month-year-picker";
import { CategoryBreakdown } from "./category-breakdown";
import { BudgetSplit } from "./budget-split";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryData {
  id: string;
  name: string;
  total: number;
  children: { id: string; name: string; total: number }[];
}

interface MonthlySummary {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  net: number;
  categories: CategoryData[];
  incomeCategories: CategoryData[];
  bucketBreakdown: {
    NEEDS: number;
    WANTS: number;
    SAVINGS: number;
    unclassified: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Compute a percentage-change delta string and its sentiment.
// Returns null when the previous value is zero (no meaningful baseline).
function computeDelta(
  current: number,
  previous: number
): { label: string; pct: number } | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const abs = Math.abs(pct).toFixed(0);
  return { label: `${pct >= 0 ? "↑" : "↓"} ${abs}%`, pct };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function MonthlySkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
      </div>
      {/* Tabs */}
      <Skeleton className="h-9 w-full rounded-lg" />
      {/* Category rows */}
      <div className="overflow-hidden rounded-xl border">
        {[1, 2, 3, 4].map((i, idx) => (
          <div key={i} className={cn("space-y-2 px-4 py-3", idx > 0 && "border-t")}>
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <Skeleton className="h-1 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MonthlySummaryContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

  const [data, setData] = useState<MonthlySummary | null>(null);
  const [prevData, setPrevData] = useState<Pick<MonthlySummary, "totalIncome" | "totalExpense" | "net"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Compute previous month — wrap around December → January
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      // Fetch current and previous month in parallel
      const [res, prevRes] = await Promise.all([
        fetch(`/api/summary/monthly?year=${year}&month=${month}`),
        fetch(`/api/summary/monthly?year=${prevYear}&month=${prevMonth}`),
      ]);

      if (res.ok) setData(await res.json());
      if (prevRes.ok) setPrevData(await prevRes.json());
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonthLabel = MONTH_SHORT[(month === 1 ? 11 : month - 2)];

  return (
    <div className="space-y-6">
      <MonthYearPicker mode="month" basePath="/summary" />

      {isLoading ? (
        <MonthlySkeleton />
      ) : data ? (
        <>
          {/* ── Stat cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {/* Income */}
            <StatCard
              label="Income"
              value={data.totalIncome}
              valueClass="text-emerald-600 dark:text-emerald-400"
              delta={prevData ? computeDelta(data.totalIncome, prevData.totalIncome) : null}
              // For income: ↑ is good
              deltaPositiveIsGood
              prevLabel={prevMonthLabel}
            />

            {/* Expenses */}
            <StatCard
              label="Expenses"
              value={data.totalExpense}
              valueClass="text-red-600 dark:text-red-400"
              delta={prevData ? computeDelta(data.totalExpense, prevData.totalExpense) : null}
              // For expenses: ↑ is bad
              deltaPositiveIsGood={false}
              prevLabel={prevMonthLabel}
            />

            {/* Net — show absolute diff instead of % (% is misleading across zero) */}
            <NetStatCard
              value={data.net}
              prevNet={prevData?.net ?? null}
              prevLabel={prevMonthLabel}
            />
          </div>

          {/* ── Tabs ───────────────────────────────────────────────────── */}
          <Tabs defaultValue="expenses">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="budget">50·30·20</TabsTrigger>
            </TabsList>

            <TabsContent value="expenses" className="mt-4">
              <CategoryBreakdown
                categories={data.categories}
                total={data.totalExpense}
                emptyMessage="No expense data for this period"
              />
            </TabsContent>

            <TabsContent value="income" className="mt-4">
              <CategoryBreakdown
                categories={data.incomeCategories || []}
                total={data.totalIncome}
                emptyMessage="No income data for this period"
              />
            </TabsContent>

            <TabsContent value="budget" className="mt-4">
              <BudgetSplit
                breakdown={data.bucketBreakdown}
                totalIncome={data.totalIncome}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Failed to load summary data
        </div>
      )}
    </div>
  );
}

// ─── Stat Card sub-components ─────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  valueClass: string;
  delta: { label: string; pct: number } | null;
  deltaPositiveIsGood: boolean;
  prevLabel: string;
}

function StatCard({ label, value, valueClass, delta, deltaPositiveIsGood, prevLabel }: StatCardProps) {
  let deltaClass = "text-muted-foreground";
  if (delta) {
    const isPositive = delta.pct > 0;
    const isGood = deltaPositiveIsGood ? isPositive : !isPositive;
    deltaClass = isGood
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";
  }

  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-0.5 text-base font-bold tabular-nums", valueClass)}>
          €{value.toFixed(2)}
        </p>
        {delta && (
          <p className={cn("mt-0.5 text-[10px] font-medium", deltaClass)}>
            {delta.label} vs {prevLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface NetStatCardProps {
  value: number;
  prevNet: number | null;
  prevLabel: string;
}

function NetStatCard({ value, prevNet, prevLabel }: NetStatCardProps) {
  const valueClass =
    value >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  let deltaEl: React.ReactNode = null;
  if (prevNet !== null) {
    const diff = value - prevNet;
    const isPositive = diff >= 0;
    const deltaClass = isPositive
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";
    deltaEl = (
      <p className={cn("mt-0.5 text-[10px] font-medium", deltaClass)}>
        {isPositive ? "↑" : "↓"} €{Math.abs(diff).toFixed(0)} vs {prevLabel}
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Net
        </p>
        <p className={cn("mt-0.5 text-base font-bold tabular-nums", valueClass)}>
          €{value.toFixed(2)}
        </p>
        {deltaEl}
      </CardContent>
    </Card>
  );
}
