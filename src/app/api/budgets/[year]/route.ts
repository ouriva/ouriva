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
// Category routing:
//   • Transactions are routed to expense or income based on Category.type (not TransactionType).
//   • An INCOME transaction in an EXPENSE category is a contra-expense (reimbursement)
//     and reduces the expense actual for that category — the net-out-of-pocket model.
//   • An EXPENSE transaction in an INCOME category is a contra-income (refund/correction
//     of income already received) and reduces the income actual for that category.
//   • An INCOME transaction in an INCOME category is real income; an EXPENSE transaction
//     in an EXPENSE category is real spending.
//   • TRANSFER transactions are excluded entirely — they never appear in budget reports.
//
// Grouping rules:
//   • Categories with a parent  → children[] of the parent group
//   • Root categories           → standalone group (children: [])
//   • When a root has children in the data, it becomes a group header:
//       budgeted = sum of children's budgets   (parent's own budget entry ignored)
//       actual   = parent's own transactions + sum of children's transactions
//
// Expense vs income seeding:
//   • Expense groups are seeded from ALL active leaf EXPENSE categories — every leaf
//     appears even with 0 budget and 0 actual, so users can plan ahead.
//   • Income groups are seeded only from INCOME categories with income budgets or
//     income transactions (income sources are stable, no need to show empty rows).
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
  bucket: BucketKey;
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
  isIncome: boolean,
  bucketMap?: Map<string, string | null>
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
  for (const [catId, total] of actualMap) {
    const isCoveredBySeed = seedLeaves.some(l => l.id === catId);
    if (!isCoveredBySeed) {
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
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .map((c) => {
          const rem = Math.round((c.budgeted - c.actual) * 100) / 100;
          const pct = c.budgeted > 0 ? Math.round((c.actual / c.budgeted) * 100) : 0;
          return {
            categoryId: c.id, categoryName: c.name,
            budgeted: c.budgeted, actual: c.actual,
            remaining: rem, percentage: pct, isIncome, note: c.note,
            bucket: (bucketMap?.get(c.id) ?? null) as BucketKey,
          };
        });

      return {
        groupId: g.groupId, groupName: g.groupName,
        categoryId: g.groupId, categoryName: g.groupName,
        budgeted: g.budgeted, actual: g.actual,
        remaining, percentage, isIncome, note: g.note, children,
        bucket: (bucketMap?.get(g.groupId) ?? null) as BucketKey,
      };
    })
    .toSorted((a, b) => a.groupName.localeCompare(b.groupName));
}

// Income groups are seeded from the union of budget+actual keys.
// Only INCOME categories appear here (filtered upstream).
function buildGroupsFromUnion(
  budgetMap: Map<string, { amount: number; note: string | null; name?: string; parentId?: string; parentName?: string }>,
  actualMap: Map<string, { total: number; name?: string; parentId?: string; parentName?: string }>,
  isIncome: boolean,
  bucketMap?: Map<string, string | null>
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

  const flatActualMap = new Map<string, number>();
  for (const [id, a] of actualMap) flatActualMap.set(id, a.total);

  return buildGroupsFromSeeds(seeds, budgetMap, flatActualMap, isIncome, bucketMap);
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

// Fetches top-level EXPENSE or INCOME transactions with their split children.
// TRANSFER transactions are automatically excluded by filtering on type.
function fetchTopLevelTransactions(
  startDate: Date,
  endDate: Date,
  type: "EXPENSE" | "INCOME"
) {
  return prisma.transaction.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      type,
      parentTransactionId: null,
    },
    include: {
      category: { include: { parent: true } },
      splits: {
        include: { category: { include: { parent: true } } },
      },
    },
  });
}

type TransactionWithCategory = {
  amount: unknown;
  category: { id: string; name: string; parent?: { id: string; name: string } | null } | null;
};

// Build expense actual map using CategoryType-aware routing:
//   • EXPENSE transactions in EXPENSE categories → add to actual (spending)
//   • INCOME transactions in EXPENSE categories → subtract from actual (reimbursements)
//   • Transactions in INCOME categories are ignored here (handled separately)
//
// This is the "contra-expense" model: a health insurance reimbursement recorded as
// an INCOME transaction in the "Doctor" (EXPENSE) category reduces your net doctor
// expense. No manual netting step needed — the routing is driven by CategoryType.
function buildExpenseActualMap(
  expenseTransactions: TransactionWithCategory[],
  incomeTransactions: TransactionWithCategory[],
  expenseCategoryIds: Set<string>
): Map<string, number> {
  const map = new Map<string, number>();

  for (const tx of expenseTransactions) {
    if (!tx.category) continue;
    if (!expenseCategoryIds.has(tx.category.id)) continue;
    map.set(tx.category.id, (map.get(tx.category.id) ?? 0) + Number(tx.amount));
  }

  // Net off: income in expense categories = contra-expense (reimbursement)
  for (const tx of incomeTransactions) {
    if (!tx.category) continue;
    if (!expenseCategoryIds.has(tx.category.id)) continue;
    map.set(tx.category.id, (map.get(tx.category.id) ?? 0) - Number(tx.amount));
  }

  return map;
}

// Build income actual map using CategoryType-aware routing:
//   • INCOME transactions in INCOME categories → add to actual (real income)
//   • EXPENSE transactions in INCOME categories → subtract from actual (contra-income:
//     a refund or correction of income already received)
//   • Transactions in EXPENSE categories are ignored here (handled separately)
function buildIncomeActualMap(
  incomeTransactions: TransactionWithCategory[],
  expenseTransactions: TransactionWithCategory[],
  incomeCategoryIds: Set<string>
): Map<string, { total: number; name?: string; parentId?: string; parentName?: string }> {
  const map = new Map<string, { total: number; name?: string; parentId?: string; parentName?: string }>();

  function addToMap(tx: TransactionWithCategory, sign: 1 | -1) {
    if (!tx.category) return;
    if (!incomeCategoryIds.has(tx.category.id)) return;
    const id = tx.category.id;
    const entry = map.get(id) ?? {
      total: 0,
      name: tx.category.name,
      parentId: (tx.category as { parent?: { id: string } | null }).parent?.id,
      parentName: (tx.category as { parent?: { name: string } | null }).parent?.name,
    };
    entry.total += sign * Number(tx.amount);
    map.set(id, entry);
  }

  for (const tx of incomeTransactions) addToMap(tx, 1);

  // Net off: expense in income categories = contra-income (refund/correction)
  for (const tx of expenseTransactions) addToMap(tx, -1);
  return map;
}

type BudgetWithCategory = {
  categoryId: string;
  amount: unknown;
  note?: string | null;
  category: {
    type: string;
    name: string;
    parent?: { id: string; name: string } | null;
    children: { id: string }[];
  };
};

function buildBudgetMaps(budgets: BudgetWithCategory[]): {
  expenseBudgetMap: Map<string, { amount: number; note: string | null }>;
  incomeBudgetMap: Map<string, { amount: number; note: string | null; parentId?: string; parentName?: string; name?: string }>;
} {
  const expenseBudgetMap = new Map<string, { amount: number; note: string | null }>();
  const incomeBudgetMap = new Map<string, { amount: number; note: string | null; parentId?: string; parentName?: string; name?: string }>();

  for (const b of budgets) {
    if (b.category.type === "INCOME") {
      incomeBudgetMap.set(b.categoryId, {
        amount: Number(b.amount),
        note: b.note ?? null,
        name: b.category.name,
        parentId: b.category.parent?.id,
        parentName: b.category.parent?.name,
      });
    } else {
      expenseBudgetMap.set(b.categoryId, { amount: Number(b.amount), note: b.note ?? null });
    }
  }

  return { expenseBudgetMap, incomeBudgetMap };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year: yearParam } = await params;
    const year = Number.parseInt(yearParam);

    if (Number.isNaN(year)) {
      return NextResponse.json(
        { error: { message: "Invalid year", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const startDate = new Date(year, 0, 1);
    const endDate   = new Date(year, 11, 31);

    // Fetch all active categories, budgets, and transactions in parallel.
    // TRANSFER transactions are excluded from both fetches (type filter).
    const [allCategories, budgets, expenseTransactionsRaw, incomeTransactionsRaw] =
      await Promise.all([
        prisma.category.findMany({
          where: { isActive: true },
          include: {
            parent: { select: { id: true, name: true, bucket: true } },
            children: { where: { isActive: true }, select: { id: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.budget.findMany({
          where: { year },
          include: {
            category: {
              include: {
                parent: true,
                children: { where: { isActive: true }, select: { id: true } },
              },
            },
          },
        }),
        fetchTopLevelTransactions(startDate, endDate, "EXPENSE"),
        fetchTopLevelTransactions(startDate, endDate, "INCOME"),
      ]);

    // Replace split parents with their children so each child's amount is
    // attributed to its own category. Regular transactions pass through as-is.
    const expenseTransactions = expenseTransactionsRaw.flatMap(tx =>
      tx.splits.length > 0 ? tx.splits : [tx]
    );
    const incomeTransactions = incomeTransactionsRaw.flatMap(tx =>
      tx.splits.length > 0 ? tx.splits : [tx]
    );

    // ── Separate categories by CategoryType ──────────────────────────────
    const expenseCategories = allCategories.filter(c => c.type === "EXPENSE");
    const incomeCategories  = allCategories.filter(c => c.type === "INCOME");
    const expenseCategoryIds = new Set(expenseCategories.map(c => c.id));
    const incomeCategoryIds  = new Set(incomeCategories.map(c => c.id));

    // ── Leaf categories for expense seed ─────────────────────────────────
    const leafExpenseCategories = expenseCategories
      .filter(c => c.children.length === 0)
      .map(c => ({
        id:         c.id,
        name:       c.name,
        parentId:   c.parent?.id ?? null,
        parentName: c.parent?.name ?? null,
      }));

    // ── Bucket map — effective bucket for every active category ───────────
    const categoryBucketMap = new Map<string, string | null>();
    for (const c of allCategories) {
      categoryBucketMap.set(c.id, effectiveBucket(c) as string | null);
    }

    // ── Actual maps ───────────────────────────────────────────────────────
    // CategoryType determines routing: EXPENSE categories net reimbursements,
    // INCOME categories accumulate income only.
    const actualExpenseMap = buildExpenseActualMap(expenseTransactions, incomeTransactions, expenseCategoryIds);
    const actualIncomeMap  = buildIncomeActualMap(incomeTransactions, expenseTransactions, incomeCategoryIds);

    // ── Budget maps ───────────────────────────────────────────────────────
    const { expenseBudgetMap, incomeBudgetMap } = buildBudgetMaps(budgets);

    // ── Build groups ──────────────────────────────────────────────────────
    // Expense: seeded from all active EXPENSE leaf categories (shows empty rows too)
    const expenseGroups = buildGroupsFromSeeds(leafExpenseCategories, expenseBudgetMap, actualExpenseMap, false, categoryBucketMap);
    // Income: seeded from INCOME categories that have budgets or transactions
    const incomeGroups = buildGroupsFromUnion(incomeBudgetMap, actualIncomeMap, true, categoryBucketMap);

    // ── Totals ────────────────────────────────────────────────────────────
    const totalBudgetedExpense = expenseGroups.reduce((s, g) => s + g.budgeted, 0);
    const totalActualExpense   = expenseGroups.reduce((s, g) => s + g.actual,   0);
    const totalBudgetedIncome  = incomeGroups.reduce( (s, g) => s + g.budgeted, 0);
    const totalActualIncome    = incomeGroups.reduce( (s, g) => s + g.actual,   0);

    // ── Planned 50/30/20 — leaf EXPENSE categories only (no double-count) ──
    const plannedBuckets = { NEEDS: 0, WANTS: 0, SAVINGS: 0, unclassified: 0 };
    for (const b of budgets) {
      if (b.category.type !== "EXPENSE") continue;
      if (!expenseCategoryIds.has(b.categoryId)) continue; // exclude hidden/inactive categories
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
