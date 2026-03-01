// Budget Content
// ==============
// Annual budget planner with income + expense sides and 50/30/20 validation.
//
// Layout:
//   1. Year picker
//   2. Stat cards  — Budgeted Income | Budgeted Expenses (2-col)
//                    Budget Balance (full width — is the plan viable?)
//   3. 50/30/20 panel — are your planned expenses in line with the rule?
//      Uses the same BudgetSplit component as the summary page,
//      but fed with *planned* budget amounts instead of actual spending.
//   4. Tabs: Expenses | Income
//      Each tab shows a compact list of categories with editable budget
//      inputs and progress bars comparing budget vs actual YTD.
//
// Editing pattern — "optimistic local state":
//   Changes are tracked in a local `edits` map keyed by "TYPE:categoryId".
//   Nothing is persisted until the user taps Save. A sticky banner appears
//   at the top when there are unsaved changes so it's never missed on mobile.

"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { MonthYearPicker } from "@/components/summary/month-year-picker";
import { BudgetSplit } from "@/components/summary/budget-split";
import { BudgetProgressBar } from "./budget-progress-bar";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BudgetCategory {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  remaining: number;
  percentage: number;
  isIncome: boolean;
}

interface BudgetData {
  year: number;
  expense: {
    totalBudgeted: number;
    totalActual: number;
    categories: BudgetCategory[];
  };
  income: {
    totalBudgeted: number;
    totalActual: number;
    categories: BudgetCategory[];
  };
  budgetBalance: number;
  plannedBucketBreakdown: {
    NEEDS: number;
    WANTS: number;
    SAVINGS: number;
    unclassified: number;
  };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function BudgetSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[72px] rounded-xl" />
        <Skeleton className="h-[72px] rounded-xl" />
      </div>
      <Skeleton className="h-[72px] rounded-xl" />
      <Skeleton className="h-[200px] rounded-xl" />
      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-[240px] rounded-xl" />
    </div>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────

interface CategoryRowProps {
  category: BudgetCategory;
  editedBudget: number;
  onChange: (value: string) => void;
}

function CategoryRow({ category, editedBudget, onChange }: CategoryRowProps) {
  const remaining = Math.round((editedBudget - category.actual) * 100) / 100;
  const percentage =
    editedBudget > 0
      ? Math.round((category.actual / editedBudget) * 100)
      : 0;

  const remainingClass =
    category.isIncome
      ? remaining <= 0
        ? "text-emerald-600 dark:text-emerald-400"  // received >= budgeted = good
        : "text-muted-foreground"
      : remaining >= 0
        ? "text-emerald-600 dark:text-emerald-400"  // under budget = good
        : "text-red-600 dark:text-red-400";

  const remainingLabel = category.isIncome
    ? remaining > 0
      ? `€${remaining.toFixed(2)} to go`
      : `€${Math.abs(remaining).toFixed(2)} over`
    : remaining >= 0
      ? `€${remaining.toFixed(2)} left`
      : `€${Math.abs(remaining).toFixed(2)} over`;

  return (
    <div className="space-y-2 px-4 py-3">
      {/* Name + actual */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{category.categoryName}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          €{category.actual.toFixed(2)} actual
        </span>
      </div>

      {/* Progress bar */}
      <BudgetProgressBar percentage={percentage} inverse={category.isIncome} />

      {/* Budget input + remaining */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Budget</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            €
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={editedBudget}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-28 pl-5 text-right text-sm tabular-nums"
          />
        </div>
        <span className={cn("ml-auto text-xs font-medium tabular-nums", remainingClass)}>
          {remainingLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BudgetContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  const [data, setData] = useState<BudgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // edits keyed as "EXPENSE:categoryId" or "INCOME:categoryId"
  const [edits, setEdits] = useState<Record<string, number>>({});

  const editKey = (type: "EXPENSE" | "INCOME", categoryId: string) =>
    `${type}:${categoryId}`;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setEdits({});
    try {
      const res = await fetch(`/api/budgets/${year}`);
      if (res.ok) setData(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasEdits = Object.keys(edits).length > 0;

  function handleChange(type: "EXPENSE" | "INCOME", categoryId: string, value: string) {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) return;
    setEdits((prev) => ({ ...prev, [editKey(type, categoryId)]: amount }));
  }

  async function handleSave() {
    if (!data) return;
    setIsSaving(true);
    try {
      const budgets = [
        ...data.expense.categories.map((c) => ({
          categoryId: c.categoryId,
          type: "EXPENSE" as const,
          amount: edits[editKey("EXPENSE", c.categoryId)] ?? c.budgeted,
        })),
        ...data.income.categories.map((c) => ({
          categoryId: c.categoryId,
          type: "INCOME" as const,
          amount: edits[editKey("INCOME", c.categoryId)] ?? c.budgeted,
        })),
      ];

      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, budgets }),
      });

      if (res.ok) {
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
      <MonthYearPicker mode="year" basePath="/budget" />

      {/* Unsaved changes banner — sticky so it's never off-screen on mobile */}
      {hasEdits && (
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">Unsaved changes</p>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      )}

      {isLoading ? (
        <BudgetSkeleton />
      ) : data ? (
        <>
          {/* ── Stat cards — 2+1 layout ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="py-0">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Budgeted Income
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  €{data.income.totalBudgeted.toFixed(2)}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  €{data.income.totalActual.toFixed(2)} received
                </p>
              </CardContent>
            </Card>

            <Card className="py-0">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Budgeted Expenses
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                  €{data.expense.totalBudgeted.toFixed(2)}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  €{data.expense.totalActual.toFixed(2)} spent
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="py-0">
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Budget Balance
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  data.budgetBalance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                €{data.budgetBalance.toFixed(2)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {data.budgetBalance >= 0
                  ? "Plan is viable — income covers expenses"
                  : "Plan is not viable — expenses exceed income"}
              </p>
            </CardContent>
          </Card>

          {/* ── Planned 50/30/20 ────────────────────────────────────── */}
          {data.income.totalBudgeted > 0 && (
            <Card className="py-0">
              <CardContent className="p-3 pb-4">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Planned 50·30·20 Allocation
                </p>
                <BudgetSplit
                  breakdown={data.plannedBucketBreakdown}
                  totalIncome={data.income.totalBudgeted}
                />
              </CardContent>
            </Card>
          )}

          {/* ── Category tabs ────────────────────────────────────────── */}
          <Tabs defaultValue="expenses">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
            </TabsList>

            <TabsContent value="expenses" className="mt-4">
              {data.expense.categories.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">
                  No expense categories for {year}
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-lg border">
                  {data.expense.categories.map((cat) => (
                    <CategoryRow
                      key={cat.categoryId}
                      category={cat}
                      editedBudget={
                        edits[editKey("EXPENSE", cat.categoryId)] ?? cat.budgeted
                      }
                      onChange={(v) => handleChange("EXPENSE", cat.categoryId, v)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="income" className="mt-4">
              {data.income.categories.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">
                  No income categories for {year}.{" "}
                  Add income transactions to see them here.
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-lg border">
                  {data.income.categories.map((cat) => (
                    <CategoryRow
                      key={cat.categoryId}
                      category={cat}
                      editedBudget={
                        edits[editKey("INCOME", cat.categoryId)] ?? cat.budgeted
                      }
                      onChange={(v) => handleChange("INCOME", cat.categoryId, v)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Failed to load budget data
        </div>
      )}
    </div>
  );
}
