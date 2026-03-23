// API: GET /api/budgets/[year]
// ============================
// Returns budget vs actual comparison for a specific year, split by type.
//
// Response shape:
//   expense / income
//     totalBudgeted, totalActual
//     groups[]  — one entry per parent category (group header) or standalone leaf
//       groupId, groupName, budgeted, actual, remaining, percentage, isIncome, note
//       children[]  — leaf categories under this parent (empty if standalone leaf)
//         categoryId, categoryName, budgeted, actual, remaining, percentage, isIncome, note
//
// Grouping rules:
//   • Categories with a parent  → children[] of the parent group
//   • Root categories           → standalone group (children: [])
//   • When a root has children in the data, it becomes a group header:
//       budgeted = sum of children's budgets   (parent's own budget entry ignored)
//       actual   = parent's own transactions + sum of children's transactions
//
// Expense vs income seeding:
//   • Expense groups are seeded from ALL active leaf categories — every leaf
//     appears even with 0 budget and 0 actual, so users can plan ahead.
//   • Income groups are seeded only from categories with income budgets or
//     income transactions (existing behaviour — income sources are stable).
//
// Actual tracking: transactions are kept at their assigned category level —
//   no rollup to parent. Each child shows its own progress independently.
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
  note: string | null;
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

// Build groups from a pre-defined set of leaf category seeds.
// budgetMap  — existing budget entries for the year (may not cover all seeds)
// actualMap  — transaction totals at the assigned category level (no rollup)
// seedLeaves — all leaf categories to include (may exceed budgetMap keys)
function buildGroupsFromSeeds(
  seedLeaves: { id: string; name: string; parentId?: string | null; parentName?: string | null }[],
  budgetMap: Map<string, { amount: number; note: string | null }>,
  actualMap: Map<string, number>,
  isIncome: boolean
): GroupEntry[] {
  type RawGroup = {
    groupId: string; groupName: string;
    budgeted: number; actual: number;
    note: string | null;
    children: { id: string; name: string; budgeted: number; actual: number; note: string | null }[];
  };
  const groups = new Map<string, RawGroup>();

  // Pass 1 — root leaves (no parent) → standalone groups
  for (const leaf of seedLeaves) {
    if (!leaf.parentId) {
      const b = budgetMap.get(leaf.id);
      groups.set(leaf.id, {
        groupId:   leaf.id,
        groupName: leaf.name,
        budgeted:  Math.round((b?.amount ?? 0) * 100) / 100,
        actual:    Math.round((actualMap.get(leaf.id) ?? 0) * 100) / 100,
        note:      b?.note ?? null,
        children:  [],
      });
    }
  }

  // Pass 2 — child leaves → add to parent group (creating shell if parent has no own data)
  for (const leaf of seedLeaves) {
    if (!leaf.parentId) continue;

    const b = budgetMap.get(leaf.id);
    const childBudgeted = Math.round((b?.amount ?? 0) * 100) / 100;
    const childActual   = Math.round((actualMap.get(leaf.id) ?? 0) * 100) / 100;

    let group = groups.get(leaf.parentId);
    if (!group) {
      // Parent not in seeds (no own budget/actual) — create empty shell
      group = {
        groupId:   leaf.parentId,
        groupName: leaf.parentName ?? leaf.parentId,
        budgeted:  0,
        actual:    0,
        note:      null,
        children:  [],
      };
      groups.set(leaf.parentId, group);
    } else if (group.children.length === 0) {
      // Converting standalone root to group:
      //   • budgeted reset to 0 (will be summed from children)
      //   • actual kept as-is (parent-assigned transactions still count)
      group.budgeted = 0;
    }

    group.budgeted = Math.round((group.budgeted + childBudgeted) * 100) / 100;
    group.actual   = Math.round((group.actual   + childActual)   * 100) / 100;
    group.children.push({ id: leaf.id, name: leaf.name, budgeted: childBudgeted, actual: childActual, note: b?.note ?? null });
  }

  // Also add actual from transactions assigned directly to parent categories
  // (those parent categories are not in seedLeaves, so we handle them here)
  for (const [catId, total] of actualMap) {
    // If this category appears in a group as a child, it's already counted.
    // If it's a key in groups, it's a standalone — already counted.
    // We only need to add actuals for categories not covered by seedLeaves.
    const isCoveredBySeed = seedLeaves.some(l => l.id === catId);
    if (!isCoveredBySeed) {
      // This is a parent category with direct transactions — add to its group actual
      const group = groups.get(catId);
      if (group) {
        group.actual = Math.round((group.actual + Math.round(total * 100) / 100) * 100) / 100;
      }
    }
  }

  // Finalise: compute derived fields and sort
  return Array.from(groups.values())
    .map((g): GroupEntry => {
      const remaining  = Math.round((g.budgeted - g.actual) * 100) / 100;
      const percentage = g.budgeted > 0 ? Math.round((g.actual / g.budgeted) * 100) : 0;

      const children: LeafEntry[] = g.children
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => {
          const rem = Math.round((c.budgeted - c.actual) * 100) / 100;
          const pct = c.budgeted > 0 ? Math.round((c.actual / c.budgeted) * 100) : 0;
          return {
            categoryId: c.id, categoryName: c.name,
            budgeted: c.budgeted, actual: c.actual,
            remaining: rem, percentage: pct, isIncome, note: c.note,
          };
        });

      return {
        groupId: g.groupId, groupName: g.groupName,
        categoryId: g.groupId, categoryName: g.groupName,
        budgeted: g.budgeted, actual: g.actual,
        remaining, percentage, isIncome, note: g.note, children,
      };
    })
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

// Income groups are seeded from the union of budget+actual keys (existing behaviour).
// This keeps the income tab focused on known income sources.
function buildGroupsFromUnion(
  budgetMap: Map<string, { amount: number; note: string | null; name?: string; parentId?: string; parentName?: string }>,
  actualMap: Map<string, { total: number; name?: string; parentId?: string; parentName?: string }>,
  isIncome: boolean
): GroupEntry[] {
  const allIds = new Set([...budgetMap.keys(), ...actualMap.keys()]);
  const seeds = Array.from(allIds).map((id) => {
    const b = budgetMap.get(id);
    const a = actualMap.get(id);
    return {
      id,
      name:       b?.name ?? (a as { name?: string })?.name ?? id,
      parentId:   b?.parentId ?? a?.parentId ?? null,
      parentName: b?.parentName ?? a?.parentName ?? null,
    };
  });

  // Reuse budgetMap but adapt actualMap to match the signature
  const flatActualMap = new Map<string, number>();
  for (const [id, a] of actualMap) flatActualMap.set(id, a.total);

  return buildGroupsFromSeeds(seeds, budgetMap, flatActualMap, isIncome);
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

    // Fetch all active categories (for expense seed), budgets, and transactions in parallel.
    const [allCategories, budgets, expenseTransactions, incomeTransactions] =
      await Promise.all([
        // All active leaf categories — seed for expense groups
        prisma.category.findMany({
          where: {
            isActive: true,
            ...(transferCategoryId && { id: { not: transferCategoryId } }),
          },
          include: {
            parent: { select: { id: true, name: true } },
            children: { where: { isActive: true }, select: { id: true } },
          },
          orderBy: { name: "asc" },
        }),
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

    // ── Leaf categories for expense seed ─────────────────────────────────
    const leafCategories = allCategories
      .filter(c => c.children.length === 0)
      .map(c => ({
        id:         c.id,
        name:       c.name,
        parentId:   c.parent?.id ?? null,
        parentName: c.parent?.name ?? null,
      }));

    // ── Actual maps — no rollup to parent ────────────────────────────────
    const actualExpenseMap = new Map<string, number>();
    for (const tx of expenseTransactions) {
      if (!tx.category) continue;
      actualExpenseMap.set(tx.category.id, (actualExpenseMap.get(tx.category.id) ?? 0) + Number(tx.amount));
    }

    const actualIncomeMap = new Map<string, { total: number; parentId?: string; parentName?: string; name?: string }>();
    for (const tx of incomeTransactions) {
      if (!tx.category) continue;
      const id   = tx.category.id;
      const entry = actualIncomeMap.get(id) ?? {
        total: 0, name: tx.category.name,
        parentId: tx.category.parent?.id, parentName: tx.category.parent?.name,
      };
      entry.total += Number(tx.amount);
      actualIncomeMap.set(id, entry);
    }

    // ── Budget maps ───────────────────────────────────────────────────────
    const expenseBudgetMap = new Map<string, { amount: number; note: string | null }>();
    const incomeBudgetMap  = new Map<string, { amount: number; note: string | null; parentId?: string; parentName?: string; name?: string }>();

    for (const b of budgets) {
      if (b.type === "INCOME") {
        incomeBudgetMap.set(b.categoryId, {
          amount:     Number(b.amount),
          note:       b.note ?? null,
          name:       b.category.name,
          parentId:   b.category.parent?.id,
          parentName: b.category.parent?.name,
        });
      } else {
        expenseBudgetMap.set(b.categoryId, { amount: Number(b.amount), note: b.note ?? null });
      }
    }

    // ── Net off reimbursements — income in expense categories ─────────────
    // Income transactions assigned to an expense category (e.g. an insurance
    // reimbursement categorised as "Health") are treated as contra-expenses:
    //   • They reduce the expense actual → net out-of-pocket cost
    //   • They are removed from the income actual → not double-counted
    //
    // A category is "in expense context" when it has expense transactions or
    // an expense budget target. Pure income categories (salary, freelance)
    // are untouched.
    for (const tx of incomeTransactions) {
      if (!tx.category) continue;
      const catId = tx.category.id;
      if (actualExpenseMap.has(catId) || expenseBudgetMap.has(catId)) {
        // Reduce expense actual (may go negative if reimbursement > expense)
        actualExpenseMap.set(catId, (actualExpenseMap.get(catId) ?? 0) - Number(tx.amount));
        // Remove from income actual so it doesn't show on the income tab
        const incEntry = actualIncomeMap.get(catId);
        if (incEntry) {
          incEntry.total -= Number(tx.amount);
          if (incEntry.total <= 0) {
            actualIncomeMap.delete(catId);
          }
        }
      }
    }

    // ── Build grouped category lists ──────────────────────────────────────
    // Expense: seeded from all active leaf categories
    const expenseGroups = buildGroupsFromSeeds(leafCategories, expenseBudgetMap, actualExpenseMap, false);

    // Income: seeded from union of budget+actual keys only
    const incomeGroups = buildGroupsFromUnion(incomeBudgetMap, actualIncomeMap, true);

    // ── Totals ────────────────────────────────────────────────────────────
    const totalBudgetedExpense = expenseGroups.reduce((s, g) => s + g.budgeted, 0);
    const totalActualExpense   = expenseGroups.reduce((s, g) => s + g.actual,   0);
    const totalBudgetedIncome  = incomeGroups.reduce( (s, g) => s + g.budgeted, 0);
    const totalActualIncome    = incomeGroups.reduce( (s, g) => s + g.actual,   0);

    // ── Planned 50/30/20 — leaf categories only (no double-count) ────────
    const plannedBuckets = { NEEDS: 0, WANTS: 0, SAVINGS: 0, unclassified: 0 };
    for (const b of budgets.filter((b) => b.type === "EXPENSE")) {
      if (b.category.children.length > 0) continue;
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
