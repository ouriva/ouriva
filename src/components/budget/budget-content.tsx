// Budget Content
// ==============
// Client component that shows budget vs actual comparison.
// Each category row displays: budgeted amount, actual YTD,
// remaining, and a progress bar.
//
// Inline editing: The budgeted amount is an <input> field.
// When the user changes a value, it's tracked locally. When
// they click "Save", all changes are sent to the API in one
// bulk upsert request.
//
// Key pattern — "optimistic local state":
// We fetch data from the API, then let the user edit locally.
// Changes aren't persisted until "Save" is clicked. This avoids
// making an API call on every keystroke and lets the user review
// all their changes before committing.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { MonthYearPicker } from "@/components/summary/month-year-picker";
import { BudgetProgressBar } from "./budget-progress-bar";

interface BudgetCategory {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  remaining: number;
  percentage: number;
}

interface BudgetData {
  year: number;
  totalBudgeted: number;
  totalActual: number;
  totalRemaining: number;
  categories: BudgetCategory[];
}

export function BudgetContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  const [data, setData] = useState<BudgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Local edits: maps categoryId → edited budget amount
  const [edits, setEdits] = useState<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setEdits({}); // Clear edits when switching years
    try {
      const res = await fetch(`/api/budgets/${year}`);
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

  // Track whether anything has been edited
  const hasEdits = Object.keys(edits).length > 0;

  function handleAmountChange(categoryId: string, value: string) {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) return;
    setEdits((prev) => ({ ...prev, [categoryId]: amount }));
  }

  async function handleSave() {
    if (!data) return;

    setIsSaving(true);
    try {
      // Build the full list of budgets (original + edits merged)
      const budgets = data.categories.map((cat) => ({
        categoryId: cat.categoryId,
        amount: edits[cat.categoryId] ?? cat.budgeted,
      }));

      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, budgets }),
      });

      if (res.ok) {
        // Refresh to get updated actual vs budget comparison
        await fetchData();
      } else {
        const error = await res.json();
        alert(error.error?.message || "Failed to save budgets");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Year navigator */}
      <MonthYearPicker mode="year" basePath="/budget" />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Overall totals */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Budgeted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold tabular-nums">
                  €{data.totalBudgeted.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Actual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold tabular-nums">
                  €{data.totalActual.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Remaining
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    data.totalRemaining >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  €{data.totalRemaining.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Save button — only visible when there are edits */}
          {hasEdits && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          )}

          {/* Category budget rows */}
          <div className="space-y-3">
            {data.categories.map((category) => {
              // Use edited value if it exists, otherwise the original
              const displayBudget =
                edits[category.categoryId] ?? category.budgeted;
              // Recalculate percentage based on potentially edited budget
              const displayPct =
                displayBudget > 0
                  ? Math.round((category.actual / displayBudget) * 100)
                  : 0;

              return (
                <Card key={category.categoryId}>
                  <CardContent className="space-y-3 py-3">
                    {/* Category name */}
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{category.categoryName}</span>
                      <span
                        className={`text-sm font-medium ${
                          (edits[category.categoryId] ?? category.budgeted) -
                            category.actual >=
                          0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        €
                        {(
                          (edits[category.categoryId] ?? category.budgeted) -
                          category.actual
                        ).toFixed(2)}{" "}
                        left
                      </span>
                    </div>

                    {/* Progress bar */}
                    <BudgetProgressBar percentage={displayPct} />

                    {/* Budget vs Actual row */}
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Budget:</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                            €
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={displayBudget}
                            onChange={(e) =>
                              handleAmountChange(
                                category.categoryId,
                                e.target.value
                              )
                            }
                            className="h-8 w-28 pl-6 text-right tabular-nums"
                          />
                        </div>
                      </div>
                      <div className="text-muted-foreground">
                        Actual:{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          €{category.actual.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {data.categories.length === 0 && (
              <div className="rounded-lg border p-8 text-center text-muted-foreground">
                No categories with budgets or expenses for {year}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Failed to load budget data
        </div>
      )}
    </div>
  );
}
