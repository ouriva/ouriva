// Annual Summary Content
// ======================
// Fetches and displays the annual summary: yearly totals, a chart
// (income vs expenses per month), and a category table with per-month
// column breakdown.
//
// The chart and category table are linked: clicking a category row
// switches the chart from the overall income/expense overview to a
// bar chart showing that category's monthly spending. A label + reset
// button on the chart card header communicate the current view.

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthYearPicker } from "./month-year-picker";
import { AnnualBarChart } from "@/components/charts/annual-bar-chart";
import { AnnualCategoryTable } from "./annual-category-table";
import { BudgetSplit } from "./budget-split";
import { useBudgetSplitVisibility } from "@/hooks/use-budget-split-visibility";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnnualCategoryData {
  id: string;
  name: string;
  total: number;
  months: number[];
  children: { id: string; name: string; total: number; months: number[] }[];
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
  const t = useTranslations("summary");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const now = new Date();
  const year = Number.parseInt(searchParams.get("year") || String(now.getFullYear()));

  // For the current year, only render months up to today so the chart
  // doesn't show a flat line to zero for months that haven't happened yet.
  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;

  const [data, setData] = useState<AnnualSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showInSummary: showBudgetSplit, targets } = useBudgetSplitVisibility();

  // Which category row is currently selected — drives what the chart shows.
  // null = overview (income vs expense lines).
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Tracks the active tab so selectedCategoryData can look up the right list.
  const [activeTab, setActiveTab] = useState("overview");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setSelectedCategoryId(null); // reset chart when year changes
    try {
      const res = await fetch(`/api/summary/annual?year=${year}`);
      if (res.ok) setData(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Merge expense and income annual categories by ID for the "All" tab.
  // net total = incomeTotal - expenseTotal per category.
  // net months = incomeMonths[i] - expenseMonths[i] per month.
  const mergedAnnualCategories = useMemo<AnnualCategoryData[]>(() => {
    if (!data) return [];
    const map = new Map<string, AnnualCategoryData>();

    for (const cat of data.categories) {
      const childMap = new Map<string, AnnualCategoryData["children"][number]>();
      for (const child of cat.children) {
        childMap.set(child.id, { id: child.id, name: child.name, total: -child.total, months: child.months.map((v) => -v) });
      }
      map.set(cat.id, { id: cat.id, name: cat.name, total: -cat.total, months: cat.months.map((v) => -v), children: Array.from(childMap.values()) });
    }

    for (const cat of data.incomeCategories ?? []) {
      if (map.has(cat.id)) {
        const entry = map.get(cat.id)!;
        entry.total += cat.total;
        for (let i = 0; i < 12; i++) entry.months[i] += cat.months[i];
        const childMap = new Map(entry.children.map((c) => [c.id, c]));
        for (const child of cat.children) {
          if (childMap.has(child.id)) {
            const ec = childMap.get(child.id)!;
            ec.total += child.total;
            for (let i = 0; i < 12; i++) ec.months[i] += child.months[i];
          } else {
            childMap.set(child.id, { id: child.id, name: child.name, total: child.total, months: [...child.months] });
          }
        }
        entry.children = Array.from(childMap.values());
      } else {
        map.set(cat.id, { id: cat.id, name: cat.name, total: cat.total, months: [...cat.months], children: cat.children.map((c) => ({ ...c, months: [...c.months] })) });
      }
    }

    return Array.from(map.values())
      .map((cat) => ({ ...cat, children: cat.children.toSorted((a, b) => Math.abs(b.total) - Math.abs(a.total)) }))
      .toSorted((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [data]);

  // Resolve the selected category's monthly data for the chart.
  // When on the "All" tab, uses merged net months so the chart reflects
  // the same values shown in the table. Other tabs use the raw lists.
  const selectedCategoryData = useMemo(() => {
    if (!selectedCategoryId || !data) return undefined;

    const source = activeTab === "overview"
      ? mergedAnnualCategories
      : [...(data.categories ?? []), ...(data.incomeCategories ?? [])];

    const parent = source.find((c) => c.id === selectedCategoryId);
    if (parent) return { name: parent.name, months: parent.months };
    for (const cat of source) {
      const child = cat.children.find((c) => c.id === selectedCategoryId);
      if (child) return { name: child.name, months: child.months };
    }
    return undefined;
  }, [selectedCategoryId, data, activeTab, mergedAnnualCategories]);

  return (
    <div className="space-y-6">
      <MonthYearPicker mode="year" basePath="/summary/annual" />

      {isLoading && <AnnualSkeleton />}
      {!isLoading && !data && (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          {t("loadError")}
        </div>
      )}
      {!isLoading && data && (
        <>
          {/* ── Stat cards — 2+1 layout ────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="py-0">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("income")}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-positive">
                  €{formatAmount(data.totalIncome, locale)}
                </p>
              </CardContent>
            </Card>

            <Card className="py-0">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("expenses")}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-danger">
                  €{formatAmount(data.totalExpense, locale)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="py-0">
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("netSaved")}
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  data.net >= 0
                    ? "text-positive"
                    : "text-danger"
                )}
              >
                €{formatAmount(data.net, locale)}
              </p>
            </CardContent>
          </Card>

          {/* ── Chart — title matches the stat card label style ──────── */}
          <Card className="py-0">
            <CardContent className="p-3 pb-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {selectedCategoryData
                    ? selectedCategoryData.name
                    : t("monthlyOverview")}
                </p>
                {selectedCategoryData && (
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className="shrink-0 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("backToOverview")}
                  </button>
                )}
              </div>
              {/* -mx-3 offsets the CardContent padding so the chart fills
                  the full card width; the chart's own margin.left handles
                  the Jan label breathing room */}
              <div className="-mx-3">
                <AnnualBarChart
                  data={data.months}
                  maxMonth={maxMonth}
                  categoryData={selectedCategoryData}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Tabs — switching tabs resets chart to overview ────────── */}
          <Tabs
            defaultValue="overview"
            onValueChange={(v) => { setSelectedCategoryId(null); setActiveTab(v); }}
          >
            <TabsList className={cn("grid w-full", showBudgetSplit ? "grid-cols-4" : "grid-cols-3")}>
              <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
              <TabsTrigger value="expenses">{t("tabExpenses")}</TabsTrigger>
              <TabsTrigger value="income">{t("tabIncome")}</TabsTrigger>
              {showBudgetSplit && (
                <TabsTrigger value="budget">{`${targets.NEEDS}·${targets.WANTS}·${targets.SAVINGS}`}</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <AnnualCategoryTable
                categories={mergedAnnualCategories}
                emptyMessage={t("noDataPeriod")}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                signedValues
                monthCount={maxMonth}
              />
            </TabsContent>

            <TabsContent value="expenses" className="mt-4">
              <AnnualCategoryTable
                categories={data.categories}
                emptyMessage={t("noExpenseDataYear")}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                monthCount={maxMonth}
              />
            </TabsContent>

            <TabsContent value="income" className="mt-4">
              <AnnualCategoryTable
                categories={data.incomeCategories || []}
                emptyMessage={t("noIncomeDataYear")}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                monthCount={maxMonth}
              />
            </TabsContent>

            {showBudgetSplit && (
              <TabsContent value="budget" className="mt-4">
                <BudgetSplit
                  breakdown={data.bucketBreakdown}
                  totalIncome={data.totalIncome}
                  targets={targets}
                />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}
