// API: GET /api/budgets/[year]
// ============================
// Returns budget vs actual comparison for a specific year, split by type:
//
//   expense  — planned expense budgets vs actual YTD expenses
//   income   — planned income budgets vs actual YTD income
//
// Also returns:
//   budgetBalance         — budgetedIncome - budgetedExpenses (is the plan viable?)
//   plannedBucketBreakdown — planned expense amounts grouped by 50/30/20 bucket,
//                            so the UI can show whether the budget plan itself
//                            respects the 50/30/20 rule before you even spend.
//
// Category roll-up: budgets live at the parent level; child-category
// transactions are attributed to their parent (same as summary APIs).
//
// Effective bucket: category.bucket ?? category.parent?.bucket ?? null
// — the same inheritance rule used in the summary APIs.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransferCategoryId } from "@/lib/settings";

function effectiveBucket(
  category: {
    bucket: string | null;
    parent?: { bucket: string | null } | null;
  } | null
): "NEEDS" | "WANTS" | "SAVINGS" | null {
  return (category?.bucket ?? category?.parent?.bucket ?? null) as
    | "NEEDS"
    | "WANTS"
    | "SAVINGS"
    | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year: yearParam } = await params;
    const year = parseInt(yearParam);

    if (isNaN(year)) {
      return NextResponse.json(
        { error: { message: "Invalid year", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const transferCategoryId = await getTransferCategoryId();

    // Fetch budgets (both types) and transactions (both types) in parallel
    const [budgets, expenseTransactions, incomeTransactions] =
      await Promise.all([
        prisma.budget.findMany({
          where: {
            year,
            ...(transferCategoryId && {
              categoryId: { not: transferCategoryId },
            }),
          },
          include: { category: { include: { parent: true } } },
        }),
        prisma.transaction.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            type: "EXPENSE",
            parentTransactionId: null,
            ...(transferCategoryId && {
              categoryId: { not: transferCategoryId },
            }),
          },
          include: { category: { include: { parent: true } } },
        }),
        prisma.transaction.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            type: "INCOME",
            parentTransactionId: null,
            ...(transferCategoryId && {
              categoryId: { not: transferCategoryId },
            }),
          },
          include: { category: { include: { parent: true } } },
        }),
      ]);

    // ── Build actual maps (roll child amounts up to parent) ──────────
    const actualExpenseMap = new Map<string, { id: string; name: string; total: number }>();
    for (const tx of expenseTransactions) {
      if (!tx.category) continue;
      const parentId = tx.category.parent?.id ?? tx.category.id;
      const parentName = tx.category.parent?.name ?? tx.category.name;
      const entry = actualExpenseMap.get(parentId) ?? { id: parentId, name: parentName, total: 0 };
      entry.total += Number(tx.amount);
      actualExpenseMap.set(parentId, entry);
    }

    const actualIncomeMap = new Map<string, { id: string; name: string; total: number }>();
    for (const tx of incomeTransactions) {
      if (!tx.category) continue;
      const parentId = tx.category.parent?.id ?? tx.category.id;
      const parentName = tx.category.parent?.name ?? tx.category.name;
      const entry = actualIncomeMap.get(parentId) ?? { id: parentId, name: parentName, total: 0 };
      entry.total += Number(tx.amount);
      actualIncomeMap.set(parentId, entry);
    }

    // ── Build budget maps ────────────────────────────────────────────
    const expenseBudgetMap = new Map<string, { id: string; name: string; amount: number }>();
    const incomeBudgetMap  = new Map<string, { id: string; name: string; amount: number }>();

    for (const b of budgets) {
      const map = b.type === "INCOME" ? incomeBudgetMap : expenseBudgetMap;
      map.set(b.categoryId, {
        id: b.categoryId,
        name: b.category.name,
        amount: Number(b.amount),
      });
    }

    // ── Merge into category lists ────────────────────────────────────
    function mergeCategories(
      budgetMap: Map<string, { id: string; name: string; amount: number }>,
      actualMap: Map<string, { id: string; name: string; total: number }>,
      isIncome: boolean
    ) {
      const merged = new Map<
        string,
        { categoryId: string; categoryName: string; budgeted: number; actual: number }
      >();

      for (const [id, b] of budgetMap) {
        merged.set(id, {
          categoryId: id,
          categoryName: b.name,
          budgeted: b.amount,
          actual: actualMap.get(id)?.total ?? 0,
        });
      }
      for (const [id, a] of actualMap) {
        if (!merged.has(id)) {
          merged.set(id, {
            categoryId: id,
            categoryName: a.name,
            budgeted: 0,
            actual: a.total,
          });
        }
      }

      return Array.from(merged.values())
        .map((item) => {
          const actual    = Math.round(item.actual    * 100) / 100;
          const budgeted  = Math.round(item.budgeted  * 100) / 100;
          const remaining = Math.round((budgeted - actual) * 100) / 100;
          // For income: percentage = actual / budgeted (how much received)
          // For expense: percentage = actual / budgeted (how much spent)
          const percentage = budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;
          return { ...item, actual, budgeted, remaining, percentage, isIncome };
        })
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    }

    const expenseCategories = mergeCategories(expenseBudgetMap, actualExpenseMap, false);
    const incomeCategories  = mergeCategories(incomeBudgetMap,  actualIncomeMap,  true);

    // ── Totals ───────────────────────────────────────────────────────
    const totalBudgetedExpense = expenseCategories.reduce((s, c) => s + c.budgeted, 0);
    const totalActualExpense   = expenseCategories.reduce((s, c) => s + c.actual,   0);
    const totalBudgetedIncome  = incomeCategories.reduce( (s, c) => s + c.budgeted, 0);
    const totalActualIncome    = incomeCategories.reduce( (s, c) => s + c.actual,   0);

    // ── Planned 50/30/20 breakdown ───────────────────────────────────
    // Uses the expense budget entries and the bucket on each category.
    const plannedBuckets = { NEEDS: 0, WANTS: 0, SAVINGS: 0, unclassified: 0 };
    for (const b of budgets.filter((b) => b.type === "EXPENSE")) {
      const bucket = effectiveBucket(b.category);
      plannedBuckets[bucket ?? "unclassified"] += Number(b.amount);
    }

    return NextResponse.json({
      year,
      expense: {
        totalBudgeted: Math.round(totalBudgetedExpense * 100) / 100,
        totalActual:   Math.round(totalActualExpense   * 100) / 100,
        categories:    expenseCategories,
      },
      income: {
        totalBudgeted: Math.round(totalBudgetedIncome * 100) / 100,
        totalActual:   Math.round(totalActualIncome   * 100) / 100,
        categories:    incomeCategories,
      },
      budgetBalance: Math.round((totalBudgetedIncome - totalBudgetedExpense) * 100) / 100,
      plannedBucketBreakdown: {
        NEEDS:        Math.round(plannedBuckets.NEEDS        * 100) / 100,
        WANTS:        Math.round(plannedBuckets.WANTS        * 100) / 100,
        SAVINGS:      Math.round(plannedBuckets.SAVINGS      * 100) / 100,
        unclassified: Math.round(plannedBuckets.unclassified * 100) / 100,
      },
    });
  } catch (error) {
    console.error("GET /api/budgets/[year] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
