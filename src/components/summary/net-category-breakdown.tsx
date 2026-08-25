"use client";

// Net Category Breakdown
// ======================
// Merges expense and income category lists by category ID and displays
// each category's NET cashflow: income minus expenses.
//
// A positive net means the category was a net earner for the period
// (e.g. a refund exceeded purchases). A negative net means a net spend.
//
// This mirrors how Revolut, YNAB, and Copilot display an "All" cashflow
// view — one list ordered by absolute impact, no artificial income/expense
// split. It also correctly handles categories that appear in both lists
// (e.g. Shopping with a refund) by showing a single merged row.

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatAmount } from "@/lib/formatters";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];
const UNCATEGORIZED_COLOR = "#f59e0b";

interface CategoryItem {
  id: string;
  name: string;
  total: number;
  children: { id: string; name: string; total: number }[];
}

interface NetEntry {
  id: string;
  name: string;
  net: number;
  children: { id: string; name: string; net: number }[];
}

interface NetCategoryBreakdownProps {
  expenseCategories: CategoryItem[];
  incomeCategories: CategoryItem[];
  totalCashflow: number;
}

export function NetCategoryBreakdown({
  expenseCategories,
  incomeCategories,
  totalCashflow,
}: Readonly<NetCategoryBreakdownProps>) {
  const t = useTranslations("summary");
  const locale = useLocale();

  // Build a unified map keyed by category ID.
  // Expenses subtract from the net; income adds to it.
  const merged = useMemo<NetEntry[]>(() => {
    const map = new Map<string, NetEntry>();

    for (const cat of expenseCategories) {
      const childMap = new Map<string, { id: string; name: string; net: number }>();
      for (const child of cat.children) {
        childMap.set(child.id, { id: child.id, name: child.name, net: -child.total });
      }
      map.set(cat.id, { id: cat.id, name: cat.name, net: -cat.total, children: Array.from(childMap.values()) });
    }

    for (const cat of incomeCategories) {
      if (map.has(cat.id)) {
        const entry = map.get(cat.id)!;
        entry.net += cat.total;
        const childMap = new Map(entry.children.map((c) => [c.id, c]));
        for (const child of cat.children) {
          if (childMap.has(child.id)) {
            childMap.get(child.id)!.net += child.total;
          } else {
            childMap.set(child.id, { id: child.id, name: child.name, net: child.total });
          }
        }
        entry.children = Array.from(childMap.values());
      } else {
        const childMap = new Map<string, { id: string; name: string; net: number }>();
        for (const child of cat.children) {
          childMap.set(child.id, { id: child.id, name: child.name, net: child.total });
        }
        map.set(cat.id, { id: cat.id, name: cat.name, net: cat.total, children: Array.from(childMap.values()) });
      }
    }

    return Array.from(map.values())
      .map((cat) => ({
        ...cat,
        children: cat.children.toSorted((a, b) => Math.abs(b.net) - Math.abs(a.net)),
      }))
      .toSorted((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [expenseCategories, incomeCategories]);

  if (merged.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {t("noDataPeriod")}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {merged.map((category, index) => {
          const isUncategorized = category.id === "__uncategorized__";
          const isNetIncome = category.net >= 0;
          const color = isUncategorized ? UNCATEGORIZED_COLOR : PALETTE[index % PALETTE.length];
          const pct = totalCashflow > 0 ? (Math.abs(category.net) / totalCashflow) * 100 : 0;

          return (
            <div
              key={category.id}
              className={cn(
                "border-l-4 px-4 py-3",
                index < merged.length - 1 && "border-b border-b-border"
              )}
              style={{ borderLeftColor: color }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "truncate font-medium",
                    isUncategorized && "inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {isUncategorized && <TriangleAlert className="h-3.5 w-3.5 shrink-0" />}
                  {category.name}
                </span>
                <div className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      isNetIncome && "text-positive"
                    )}
                  >
                    {isNetIncome ? "+" : "−"}€{formatAmount(Math.abs(category.net), locale)}
                  </span>
                </div>
              </div>

              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color, opacity: 0.7 }}
                />
              </div>

              {category.children.length > 0 && (
                <div className="mt-2 space-y-1 pt-1">
                  {category.children.map((child) => {
                    const childIsNetIncome = child.net >= 0;
                    const childPct = totalCashflow > 0 ? (Math.abs(child.net) / totalCashflow) * 100 : 0;
                    return (
                      <div key={child.id} className="flex items-center justify-between pl-2 text-sm">
                        <span className="truncate text-muted-foreground">{child.name}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{childPct.toFixed(1)}%</span>
                          <span
                            className={cn(
                              "tabular-nums text-muted-foreground",
                              childIsNetIncome && "text-positive"
                            )}
                          >
                            {childIsNetIncome ? "+" : ""}
                            {childIsNetIncome ? "" : "−"}€{formatAmount(Math.abs(child.net), locale)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
