// Monthly Summary Content
// =======================
// Client component that fetches and displays the monthly summary.
// Separated from the page component so the page can wrap it in
// <Suspense> — required because useSearchParams() needs a Suspense
// boundary in the App Router.
//
// Data flow:
//   1. Read year/month from URL search params (defaults to now)
//   2. Fetch /api/summary/monthly?year=X&month=Y
//   3. Render stat cards + pie chart + category breakdown

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { MonthYearPicker } from "./month-year-picker";
import { ExpensePieChart } from "@/components/charts/expense-pie-chart";
import { CategoryBreakdown } from "./category-breakdown";

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
}

export function MonthlySummaryContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

  const [data, setData] = useState<MonthlySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/summary/monthly?year=${year}&month=${month}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Month navigator */}
      <MonthYearPicker mode="month" basePath="/summary" />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Summary stat cards — 3 across on mobile */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                  €{data.totalIncome.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                  €{data.totalExpense.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Net
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    data.net >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  €{data.net.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Expenses / Income tabs — controls both chart and category list */}
          <Tabs defaultValue="expenses">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
            </TabsList>

            <TabsContent value="expenses" className="space-y-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Expense Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpensePieChart
                    data={data.categories.map((c) => ({
                      name: c.name,
                      total: c.total,
                    }))}
                    emptyMessage="No expense data"
                  />
                </CardContent>
              </Card>

              <CategoryBreakdown
                categories={data.categories}
                total={data.totalExpense}
                emptyMessage="No expense data for this period"
              />
            </TabsContent>

            <TabsContent value="income" className="space-y-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Income Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpensePieChart
                    data={(data.incomeCategories || []).map((c) => ({
                      name: c.name,
                      total: c.total,
                    }))}
                    emptyMessage="No income data"
                  />
                </CardContent>
              </Card>

              <CategoryBreakdown
                categories={data.incomeCategories || []}
                total={data.totalIncome}
                emptyMessage="No income data for this period"
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
