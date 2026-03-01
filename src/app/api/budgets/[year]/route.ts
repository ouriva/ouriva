// API: GET /api/budgets/[year]
// ============================
// Returns budget vs actual comparison for a specific year, split by type.
//
// Response shape:
//   expense / income
//     totalBudgeted, totalActual
//     groups[]  — one entry per parent category (group header) or standalone leaf
//       groupId, groupName, budgeted, actual, remaining, percentage, isIncome
//       children[]  — leaf categories under this parent (empty if standalone leaf)
//         categoryId, categoryName, budgeted, actual, remaining, percentage, isIncome
//
// Grouping rules:
//   • Categories with a parent  → children[] of the parent group
//   • Root categories           → standalone group (children: [])
//   • When a root has children in the data, it becomes a group header:
//       budgeted = sum of children's budgets   (parent's own budget entry ignored)
//       actual   = parent's own transactions + sum of children's transactions
//
// Actual tracking: transactions are kept at their assigned category level —
//   no rollup to parent. This lets each child show its own progress.
//
// Planned 50/30/20 breakdown: uses only leaf-level budget entries so parent
//   budgets (if any remain from before the migration) are not double-counted.
//
// Effective bucket: category.bucket ?? category.parent?.bucket ?? null

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransferCategoryId } from "@/lib/settings";

// ─── Types ────────────────────────────────────────────────────────────────────

type BucketKey = "NEEDS" | "WANTS" | "SAVINGS" | null;

interface LeafEntry {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  remaining: number;
  percentage: number;
  isIncome: boolean;
}

interface GroupEntry extends LeafEntry {
  groupId: string;
  groupName: string;
  children: LeafEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function effectiveBucket(
  category: {
    bucket: string | null;
    parent?: { bucket: string | null } | null;
  } | null
): BucketKey {
  return (category?.bucket ?? category?.parent?.bucket ?? null) as BucketKey;
}

function buildGroups(
  budgetMap: Map<string, { id: string; name: string; amount: number; parentId?: string; parentName?: string }>,
  actualMap: Map<string, { id: string; name: string; total: number; parentId?: string; parentName?: string }>,
  isIncome: boolean
): GroupEntry[] {
  // ── Step 1: merge budget + actual into leaf entries ──────────────────────
  const allIds = new Set([...budgetMap.keys(), ...actualMap.keys()]);

  const leafMap = new Map<string, {
    categoryId: string; categoryName: string;
    budgeted: number; actual: number;
    parentId?: string; parentName?: string;
  }>();

  for (const id of allIds) {
    const b = budgetMap.get(id);
    const a = actualMap.get(id);
    const budgeted = Math.round((b?.amount ?? 0) * 100) / 100;
    const actual   = Math.round((a?.total  ?? 0) * 100) / 100;
    leafMap.set(id, {
      categoryId:   id,
      categoryName: b?.name ?? a?.name ?? id,
      budgeted,
      actual,
      parentId:   b?.parentId   ?? a?.parentId,
      parentName: b?.parentName ?? a?.parentName,
    });
  }

  // ── Step 2: group by parent ──────────────────────────────────────────────
  type RawGroup = {
    groupId: string; groupName: string;
    budgeted: number; actual: number;
    children: typeof leafMap extends Map<string, infer V> ? V[] : never;
  };
  const groups = new Map<string, RawGroup>();

  // Pass 1 — root categories (no parent) → standalone groups
  for (const [, leaf] of leafMap) {
    if (!leaf.parentId) {
      groups.set(leaf.categoryId, {
        groupId:   leaf.categoryId,
        groupName: leaf.categoryName,
        budgeted:  leaf.budgeted,
        actual:    leaf.actual,
        children:  [],
      });
    }
  }

  // Pass 2 — child categories → add to parent group
  for (const [, leaf] of leafMap) {
    if (!leaf.parentId) continue;

    let group = groups.get(leaf.parentId);
    if (!group) {
      // Parent has no budget/actual of its own — create an empty group shell
      group = {
        groupId:   leaf.parentId,
        groupName: leaf.parentName ?? leaf.parentId,
        budgeted:  0,
        actual:    0,
        children:  [],
      };
      groups.set(leaf.parentId, group);
    } else if (group.children.length === 0) {
      // Converting standalone root to group:
      //   • budgeted reset to 0 — will be summed from children (root's own budget ignored)
      //   • actual  kept        — root-assigned transactions still count toward group total
      group.budgeted = 0;
    }

    group.budgeted = Math.round((group.budgeted + leaf.budgeted) * 100) / 100;
    group.actual   = Math.round((group.actual   + leaf.actual)   * 100) / 100;
    group.children.push(leaf);
  }

  // ── Step 3: finalise and sort ────────────────────────────────────────────
  return Array.from(groups.values())
    .map((g): GroupEntry => {
      const remaining  = Math.round((g.budgeted - g.actual) * 100) / 100;
      const percentage = g.budgeted > 0 ? Math.round((g.actual / g.budgeted) * 100) : 0;

      const children: LeafEntry[] = g.children
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
        .map((c) => {
          const rem = Math.round((c.budgeted - c.actual) * 100) / 100;
          const pct = c.budgeted > 0 ? Math.round((c.actual / c.budgeted) * 100) : 0;
          return {
            categoryId: c.categoryId, categoryName: c.categoryName,
            budgeted: c.budgeted, actual: c.actual,
            remaining: rem, percentage: pct, isIncome,
          };
        });

      return {
        groupId: g.groupId, groupName: g.groupName,
        categoryId: g.groupId, categoryName: g.groupName, // LeafEntry fields for standalone use
        budgeted: g.budgeted, actual: g.actual,
        remaining, percentage, isIncome, children,
      };
    })
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

// ─── Route ────────────────────────────────────────────────────────────────────

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
    const endDate   = new Date(year, 11, 31);

    const transferCategoryId = await getTransferCategoryId();

    // Fetch budgets (with children count for bucket breakdown filter) and
    // transactions (kept at assigned category level — no rollup).
    const [budgets, expenseTransactions, incomeTransactions] =
      await Promise.all([
        prisma.budget.findMany({
          where: {
            year,
            ...(transferCategoryId && { categoryId: { not: transferCategoryId } }),
          },
          include: {
            category: {
              include: {
                parent: true,
                children: { where: { isActive: true }, select: { id: true } },
              },
            },
          },
        }),
        prisma.transaction.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            type: "EXPENSE",
            parentTransactionId: null,
            ...(transferCategoryId && { categoryId: { not: transferCategoryId } }),
          },
          include: { category: { include: { parent: true } } },
        }),
        prisma.transaction.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            type: "INCOME",
            parentTransactionId: null,
            ...(transferCategoryId && { categoryId: { not: transferCategoryId } }),
          },
          include: { category: { include: { parent: true } } },
        }),
      ]);

    // ── Actual maps — no rollup to parent ────────────────────────────────
    type ActualEntry = { id: string; name: string; total: number; parentId?: string; parentName?: string };

    function buildActualMap(transactions: typeof expenseTransactions) {
      const map = new Map<string, ActualEntry>();
      for (const tx of transactions) {
        if (!tx.category) continue;
        const id   = tx.category.id;
        const entry = map.get(id) ?? {
          id,
          name:       tx.category.name,
          total:      0,
          parentId:   tx.category.parent?.id,
          parentName: tx.category.parent?.name,
        };
        entry.total += Number(tx.amount);
        map.set(id, entry);
      }
      return map;
    }

    const actualExpenseMap = buildActualMap(expenseTransactions);
    const actualIncomeMap  = buildActualMap(incomeTransactions);

    // ── Budget maps ───────────────────────────────────────────────────────
    type BudgetEntry = { id: string; name: string; amount: number; parentId?: string; parentName?: string };

    const expenseBudgetMap = new Map<string, BudgetEntry>();
    const incomeBudgetMap  = new Map<string, BudgetEntry>();

    for (const b of budgets) {
      const map = b.type === "INCOME" ? incomeBudgetMap : expenseBudgetMap;
      map.set(b.categoryId, {
        id:         b.categoryId,
        name:       b.category.name,
        amount:     Number(b.amount),
        parentId:   b.category.parent?.id,
        parentName: b.category.parent?.name,
      });
    }

    // ── Build grouped category lists ──────────────────────────────────────
    const expenseGroups = buildGroups(expenseBudgetMap, actualExpenseMap, false);
    const incomeGroups  = buildGroups(incomeBudgetMap,  actualIncomeMap,  true);

    // ── Totals ────────────────────────────────────────────────────────────
    const totalBudgetedExpense = expenseGroups.reduce((s, g) => s + g.budgeted, 0);
    const totalActualExpense   = expenseGroups.reduce((s, g) => s + g.actual,   0);
    const totalBudgetedIncome  = incomeGroups.reduce( (s, g) => s + g.budgeted, 0);
    const totalActualIncome    = incomeGroups.reduce( (s, g) => s + g.actual,   0);

    // ── Planned 50/30/20 — leaf categories only (no double-count) ────────
    const plannedBuckets = { NEEDS: 0, WANTS: 0, SAVINGS: 0, unclassified: 0 };
    for (const b of budgets.filter((b) => b.type === "EXPENSE")) {
      if (b.category.children.length > 0) continue; // skip parent-level budgets
      const bucket = effectiveBucket(b.category);
      plannedBuckets[bucket ?? "unclassified"] += Number(b.amount);
    }

    return NextResponse.json({
      year,
      expense: {
        totalBudgeted: Math.round(totalBudgetedExpense * 100) / 100,
        totalActual:   Math.round(totalActualExpense   * 100) / 100,
        groups:        expenseGroups,
      },
      income: {
        totalBudgeted: Math.round(totalBudgetedIncome * 100) / 100,
        totalActual:   Math.round(totalActualIncome   * 100) / 100,
        groups:        incomeGroups,
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
