// Annual Summary Content
// ======================
// Client component that fetches and displays the annual summary.
// Shows yearly totals, a bar chart comparing monthly income vs
// expenses, and a category table with per-month breakdown.
//
// Same pattern as MonthlySummaryContent — reads year from URL
// search params, fetches from the annual API, renders the data.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { MonthYearPicker } from "./month-year-picker";
import { AnnualBarChart } from "@/components/charts/annual-bar-chart";
import { AnnualCategoryTable } from "./annual-category-table";

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
}

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
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Year navigator */}
      <MonthYearPicker mode="year" basePath="/summary/annual" />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Summary stat cards */}
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

          {/* Bar chart — income vs expenses per month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <AnnualBarChart data={data.months} />
            </CardContent>
          </Card>

          {/* Expenses / Income tabs for category tables */}
          <Tabs defaultValue="expenses">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
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
