// Annual Summary Content
// ======================
// Fetches and displays the annual summary: yearly totals, a bar chart
// (income vs expenses per month with net line overlay), and a
// category table with per-month heat map coloring.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthYearPicker } from "./month-year-picker";
import { AnnualBarChart } from "@/components/charts/annual-bar-chart";
import { AnnualCategoryTable } from "./annual-category-table";
import { BudgetSplit } from "./budget-split";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnnualCategoryData {
  id: string;
  name: string;
  total: number;
  months: number[];
  children: { id: string; name: string; total: number }[];
}

interface AnnualSummary {
  year: number;
  totalIncome: number;
  totalExpense: number;
  net: number;
  months: {
    month: number;
    income: number;
    expense: number;
    net: number;
  }[];
  categories: AnnualCategoryData[];
  incomeCategories: AnnualCategoryData[];
  bucketBreakdown: {
    NEEDS: number;
    WANTS: number;
    SAVINGS: number;
    unclassified: number;
  };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function AnnualSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
      </div>
      {/* Bar chart */}
      <Skeleton className="h-[280px] rounded-xl" />
      {/* Tabs */}
      <Skeleton className="h-9 w-full rounded-lg" />
      {/* Table */}
      <Skeleton className="h-[200px] rounded-xl" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnnualSummaryContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  const [data, setData] = useState<AnnualSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/summary/annual?year=${year}`);
      if (res.ok) setData(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <MonthYearPicker mode="year" basePath="/summary/annual" />

      {isLoading ? (
        <AnnualSkeleton />
      ) : data ? (
        <>
          {/* ── Stat cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-3 pb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Income
                </p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  €{data.totalIncome.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-3 pb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Expenses
                </p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-red-600 dark:text-red-400">
                  €{data.totalExpense.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-3 pb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Net
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-base font-bold tabular-nums",
                    data.net >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  €{data.net.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Bar chart ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <AnnualBarChart data={data.months} />
            </CardContent>
          </Card>

          {/* ── Tabs ───────────────────────────────────────────────────── */}
          <Tabs defaultValue="expenses">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="budget">50·30·20</TabsTrigger>
            </TabsList>

            <TabsContent value="expenses" className="mt-4">
              <AnnualCategoryTable
                categories={data.categories}
                emptyMessage="No expense data for this year"
              />
            </TabsContent>

            <TabsContent value="income" className="mt-4">
              <AnnualCategoryTable
                categories={data.incomeCategories || []}
                emptyMessage="No income data for this year"
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
