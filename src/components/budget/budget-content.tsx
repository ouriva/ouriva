// Budget Content
// ==============
// Annual budget planner with income + expense sides and 50/30/20 validation.
//
// Layout:
//   1. Year picker
//   2. Stat cards  — Budgeted Income | Budgeted Expenses (2-col)
//                    Budget Balance (full width — is the plan viable?)
//   3. Tabs: Expenses | Income
//      Categories are grouped by parent:
//        • Parent row  — read-only summary (sum of children)
//        • Child rows  — editable budget inputs, indented under the parent
//        • Standalone  — root categories with no children, fully editable
//      Expense tab seeds from ALL active leaf categories so users can plan
//      ahead even before their first transaction.
//   4. 50/30/20 panel — always visible; shows guidance when no income budget set
//
// Editing pattern — "optimistic local state":
//   Budget amounts → tracked in `edits` keyed by "TYPE:categoryId".
//   Notes         → tracked in `noteEdits` with the same key scheme.
//   Nothing is persisted until the user taps Save. A sticky banner appears
//   at the top when there are unsaved changes so it's never missed on mobile.

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, MessageSquare, Save } from "lucide-react";
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
  note: string | null;
}

// A group is either a parent category (with children[]) or a standalone leaf
// (children: []). The groupId/groupName fields identify the group itself.
interface BudgetGroup extends BudgetCategory {
  groupId: string;
  groupName: string;
  children: BudgetCategory[];
}

interface BudgetSide {
  totalBudgeted: number;
  totalActual: number;
  groups: BudgetGroup[];
}

interface BudgetData {
  year: number;
  expense: BudgetSide;
  income: BudgetSide;
  budgetBalance: number;
  plannedBucketBreakdown: {
    NEEDS: number;
    WANTS: number;
    SAVINGS: number;
    unclassified: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function editKey(type: "EXPENSE" | "INCOME", categoryId: string): string {
  return `${type}:${categoryId}`;
}

// Flatten a group list to leaf-level budget entries, applying any pending edits.
function collectLeaves(
  groups: BudgetGroup[],
  type: "EXPENSE" | "INCOME",
  edits: Record<string, number>,
  noteEdits: Record<string, string>
): { categoryId: string; type: "EXPENSE" | "INCOME"; amount: number; note?: string }[] {
  return groups.flatMap((g) => {
    const leaves: BudgetCategory[] =
      g.children.length > 0
        ? g.children
        : [{ ...g, categoryId: g.groupId, categoryName: g.groupName }];

    return leaves.map((c) => {
      const key = editKey(type, c.categoryId);
      return {
        categoryId: c.categoryId,
        type,
        amount: edits[key] ?? c.budgeted,
        note: key in noteEdits ? noteEdits[key] : c.note ?? undefined,
      };
    });
  });
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
      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-[240px] rounded-xl" />
      <Skeleton className="h-[200px] rounded-xl" />
    </div>
  );
}

// ─── Group header ─────────────────────────────────────────────────────────────
// Read-only row shown for parent categories. Displays the aggregate of all
// child budgets and actuals so the user sees the group total at a glance.

interface GroupHeaderProps {
  group: BudgetGroup;
}

function GroupHeader({ group }: GroupHeaderProps) {
  const t = useTranslations("budget");
  const locale = useLocale();
  const remainingClass = group.isIncome
    ? group.actual >= group.budgeted
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-muted-foreground"
    : group.remaining >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  const remainingLabel = group.isIncome
    ? group.remaining > 0
      ? t("remainingToGo", { symbol: "€", amount: formatAmount(group.remaining, locale) })
      : t("remainingOver", { symbol: "€", amount: formatAmount(Math.abs(group.remaining), locale) })
    : group.remaining >= 0
      ? t("remainingLeft", { symbol: "€", amount: formatAmount(group.remaining, locale) })
      : t("remainingOver", { symbol: "€", amount: formatAmount(Math.abs(group.remaining), locale) });

  return (
    <div className="flex items-center justify-between gap-2 bg-muted/40 px-4 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
        {group.groupName}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">
          €{formatAmount(group.actual, locale)} / €{formatAmount(group.budgeted, locale)}
        </span>
        {group.budgeted > 0 && (
          <span className={cn("text-xs font-medium tabular-nums", remainingClass)}>
            {remainingLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────
// Editable row for leaf categories (child or standalone).
// isChild=true adds left indentation to visually connect it to its group header.
//
// Note icon behaviour:
//   • Tap (short press)   → open edit mode (text input)
//   • Long press (500ms)  → open read-only preview (shows note, tap again to edit)
//   • On desktop, hovering shows a Tooltip with the note text.
// The note is fully hidden when closed — the highlighted icon is the only cue.

type NoteState = "closed" | "preview" | "edit";

interface CategoryRowProps {
  category: BudgetCategory;
  editedBudget: number;
  note: string | null;
  onChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  isChild?: boolean;
}

function CategoryRow({ category, editedBudget, note, onChange, onNoteChange, isChild }: CategoryRowProps) {
  const t = useTranslations("budget");
  const locale = useLocale();
  const [noteState, setNoteState] = useState<NoteState>("closed");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress   = useRef(false);

  function startLongPress() {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      // Only show preview if there's something to read; go straight to edit if empty
      setNoteState(note ? "preview" : "edit");
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleClick() {
    if (didLongPress.current) {
      didLongPress.current = false;
      return; // already handled by long-press timer
    }
    setNoteState((s) => (s === "edit" ? "closed" : "edit"));
  }

  const remaining = Math.round((editedBudget - category.actual) * 100) / 100;
  const percentage =
    editedBudget > 0
      ? Math.round((category.actual / editedBudget) * 100)
      : 0;

  const remainingClass =
    category.isIncome
      ? remaining <= 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground"
      : remaining >= 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";

  const remainingLabel = category.isIncome
    ? remaining > 0
      ? t("remainingToGo", { symbol: "€", amount: formatAmount(remaining, locale) })
      : t("remainingOver", { symbol: "€", amount: formatAmount(Math.abs(remaining), locale) })
    : remaining >= 0
      ? t("remainingLeft", { symbol: "€", amount: formatAmount(remaining, locale) })
      : t("remainingOver", { symbol: "€", amount: formatAmount(Math.abs(remaining), locale) });

  return (
    <div className={cn("space-y-2 py-3", isChild ? "pl-7 pr-4" : "px-4")}>
      {/* Name + note icon + actual */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{category.categoryName}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onTouchStart={startLongPress}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onClick={handleClick}
                className="shrink-0 rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <MessageSquare
                  className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    note
                      ? "text-primary"
                      : "text-muted-foreground/30 hover:text-muted-foreground"
                  )}
                />
              </button>
            </TooltipTrigger>
            {/* Desktop hover tooltip */}
            {note && (
              <TooltipContent side="top" className="max-w-[200px] text-xs">
                {note}
              </TooltipContent>
            )}
          </Tooltip>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {t("actualAmount", { symbol: "€", amount: formatAmount(category.actual, locale) })}
        </span>
      </div>

      {/* Note preview — read-only, shown on long press */}
      {noteState === "preview" && note && (
        <button
          className="w-full rounded-md border bg-muted/50 px-2.5 py-1.5 text-left text-xs italic text-muted-foreground"
          onClick={() => setNoteState("edit")}
        >
          {note}
        </button>
      )}

      {/* Note edit input — shown on tap */}
      {noteState === "edit" && (
        <Input
          autoFocus
          type="text"
          placeholder={t("addNotePlaceholder")}
          value={note ?? ""}
          onChange={(e) => onNoteChange(e.target.value)}
          onBlur={() => setNoteState(note ? "preview" : "closed")}
          className="h-7 text-xs"
        />
      )}

      {/* Progress bar */}
      <BudgetProgressBar percentage={percentage} inverse={category.isIncome} />

      {/* Budget input + remaining */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("budgetLabel")}</span>
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
  const t = useTranslations("budget");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  const [data, setData] = useState<BudgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Budget amount edits keyed as "EXPENSE:categoryId" or "INCOME:categoryId"
  const [edits, setEdits] = useState<Record<string, number>>({});
  // Note edits — same key scheme
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setEdits({});
    setNoteEdits({});
    try {
      const res = await fetch(`/api/budgets/${year}`);
      if (res.ok) setData(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasEdits = Object.keys(edits).length > 0 || Object.keys(noteEdits).length > 0;

  function handleChange(type: "EXPENSE" | "INCOME", categoryId: string, value: string) {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) return;
    setEdits((prev) => ({ ...prev, [editKey(type, categoryId)]: amount }));
  }

  function handleNoteChange(type: "EXPENSE" | "INCOME", categoryId: string, value: string) {
    setNoteEdits((prev) => ({ ...prev, [editKey(type, categoryId)]: value }));
  }

  async function handleSave() {
    if (!data) return;
    setIsSaving(true);
    try {
      const budgets = [
        ...collectLeaves(data.expense.groups, "EXPENSE", edits, noteEdits),
        ...collectLeaves(data.income.groups, "INCOME", edits, noteEdits),
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

  // Render a group: either a parent header + indented children, or a standalone leaf row.
  function renderGroup(group: BudgetGroup, type: "EXPENSE" | "INCOME") {
    if (group.children.length > 0) {
      return (
        <div key={group.groupId}>
          <GroupHeader group={group} />
          {group.children.map((cat) => {
            const key = editKey(type, cat.categoryId);
            return (
              <CategoryRow
                key={cat.categoryId}
                category={cat}
                editedBudget={edits[key] ?? cat.budgeted}
                note={key in noteEdits ? noteEdits[key] : cat.note}
                onChange={(v) => handleChange(type, cat.categoryId, v)}
                onNoteChange={(v) => handleNoteChange(type, cat.categoryId, v)}
                isChild
              />
            );
          })}
        </div>
      );
    }

    // Standalone leaf — render directly as an editable row
    const key = editKey(type, group.groupId);
    return (
      <CategoryRow
        key={group.groupId}
        category={{ ...group, categoryId: group.groupId, categoryName: group.groupName }}
        editedBudget={edits[key] ?? group.budgeted}
        note={key in noteEdits ? noteEdits[key] : group.note}
        onChange={(v) => handleChange(type, group.groupId, v)}
        onNoteChange={(v) => handleNoteChange(type, group.groupId, v)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <MonthYearPicker mode="year" basePath="/budget" />

      {/* Unsaved changes banner — sticky so it's never off-screen on mobile */}
      {hasEdits && (
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">{t("unsavedChanges")}</p>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("saveButton")}
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
                  {t("budgetedIncome")}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  €{formatAmount(data.income.totalBudgeted, locale)}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {t("received", { amount: `€${formatAmount(data.income.totalActual, locale)}` })}
                </p>
              </CardContent>
            </Card>

            <Card className="py-0">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("budgetedExpenses")}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                  €{formatAmount(data.expense.totalBudgeted, locale)}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {t("spent", { amount: `€${formatAmount(data.expense.totalActual, locale)}` })}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="py-0">
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("budgetBalance")}
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  data.budgetBalance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                €{formatAmount(data.budgetBalance, locale)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {data.budgetBalance >= 0
                  ? t("planViable")
                  : t("planNotViable")}
              </p>
            </CardContent>
          </Card>

          {/* ── Category tabs ────────────────────────────────────────── */}
          <Tabs defaultValue="expenses">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expenses">{t("tabExpenses")}</TabsTrigger>
              <TabsTrigger value="income">{t("tabIncome")}</TabsTrigger>
            </TabsList>

            <TabsContent value="expenses" className="mt-4">
              {data.expense.groups.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">
                  {t("noExpenseCategories")}
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-lg border">
                  {data.expense.groups.map((g) => renderGroup(g, "EXPENSE"))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="income" className="mt-4">
              {data.income.groups.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">
                  {t("noIncomeCategories", { year })}
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-lg border">
                  {data.income.groups.map((g) => renderGroup(g, "INCOME"))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* ── Planned 50/30/20 ────────────────────────────────────── */}
          <Card className="py-0">
            <CardContent className="p-3 pb-4">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("planned503020")}
              </p>
              {data.income.totalBudgeted === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("set503020Hint")}
                </p>
              ) : (
                <BudgetSplit
                  breakdown={data.plannedBucketBreakdown}
                  totalIncome={data.income.totalBudgeted}
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          {t("failedToLoad")}
        </div>
      )}
    </div>
  );
}
