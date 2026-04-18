// API: GET /api/summary/monthly?year=2026&month=1
// ================================================
// Returns income/expense totals and per-category breakdown for
// a specific month. Transfers are excluded from totals.
//
// Aggregation strategy:
//   We use Prisma's groupBy to get totals per category, then
//   assemble the tree structure (parent + children) in JS.
//   This is simpler than raw SQL and performs well for the
//   expected data volume (hundreds of transactions, not millions).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getExcludedCategoryIds } from "@/lib/settings";
import { getDefaultCurrency } from "@/lib/default-currency";

// ─── Module-scope types and helpers ──────────────────────────────────────────

type DefaultCurrency = { code: string; symbol: string } | null;

type CategoryEntry = {
  id: string;
  name: string;
  total: number;
  children: Map<string, { id: string; name: string; total: number }>;
};

// Category shape returned by Prisma's `include: { parent: true }`.
type TxCategory = {
  id: string;
  name: string;
  parent: { id: string; name: string } | null;
} | null;

// When a default currency is set, use baseCurrencyAmount for transactions
// that have been converted (account currency ≠ default). Fall back to
// amount for transactions already in the default currency.
function effectiveAmount(
  tx: {
    amount: { toString(): string };
    baseCurrencyAmount: { toString(): string } | null;
    fromAccount: { currency: { code: string } };
  },
  defaultCurrency: DefaultCurrency
): number {
  if (!defaultCurrency) return Number(tx.amount);
  if (tx.fromAccount.currency.code === defaultCurrency.code) return Number(tx.amount);
  return tx.baseCurrencyAmount ? Number(tx.baseCurrencyAmount) : Number(tx.amount);
}

// Accumulates a transaction's amount into the correct category entry.
// Rolls child categories up to their parent; groups uncategorised
// transactions under a shared "__uncategorized__" key.
function updateCategoryMap(
  targetMap: Map<string, CategoryEntry>,
  category: TxCategory,
  amount: number
): void {
  if (!category) {
    const uncatKey = "__uncategorized__";
    if (!targetMap.has(uncatKey)) {
      targetMap.set(uncatKey, { id: uncatKey, name: "Uncategorized", total: 0, children: new Map() });
    }
    targetMap.get(uncatKey)!.total += amount;
    return;
  }

  const parentCategory = category.parent ?? category;
  const isChild = !!category.parent;

  if (!targetMap.has(parentCategory.id)) {
    targetMap.set(parentCategory.id, {
      id: parentCategory.id,
      name: parentCategory.name,
      total: 0,
      children: new Map(),
    });
  }

  const parent = targetMap.get(parentCategory.id)!;
  parent.total += amount;

  if (isChild) {
    if (!parent.children.has(category.id)) {
      parent.children.set(category.id, { id: category.id, name: category.name, total: 0 });
    }
    parent.children.get(category.id)!.total += amount;
  }
}

function mapToSortedArray(map: Map<string, CategoryEntry>) {
  return Array.from(map.values())
    .map((cat) => ({
      ...cat,
      children: Array.from(cat.children.values()).sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const yearParam = request.nextUrl.searchParams.get("year");
    const monthParam = request.nextUrl.searchParams.get("month");

    if (!yearParam || !monthParam) {
      return NextResponse.json(
        { error: { message: "year and month are required", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);
    const month = parseInt(monthParam);

    // Build date range for the month.
    // Month is 1-indexed (1 = January), but JS Date uses 0-indexed.
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // day 0 of next month = last day of this month

    const [excludedCategoryIds, defaultCurrency] = await Promise.all([
      getExcludedCategoryIds(),
      getDefaultCurrency(),
    ]);

    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        // Exclude split parents — their total is covered by their children.
        // splits: { none: {} } means "has zero split children", which passes for
        // regular transactions and split children but excludes split parents.
        splits: { none: {} },
        ...(excludedCategoryIds.length > 0 && {
          categoryId: { notIn: excludedCategoryIds },
        }),
      },
      include: {
        category: { include: { parent: true } },
        fromAccount: { include: { currency: true } },
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    // 50/30/20 bucket breakdown — expenses only.
    // Effective bucket = category.bucket ?? parent.bucket ?? null (unclassified).
    const bucketTotals = { NEEDS: 0, WANTS: 0, SAVINGS: 0, unclassified: 0 };

    // Group by category for the breakdown.
    // We group by PARENT category — if a transaction has a child
    // category, we roll it up to the parent.
    // Two separate maps: one for expenses, one for income.
    const categoryMap = new Map<string, CategoryEntry>();
    const incomeCategoryMap = new Map<string, CategoryEntry>();

    for (const tx of transactions) {
      const amount = effectiveAmount(tx, defaultCurrency);

      if (tx.type === "INCOME") {
        totalIncome += amount;
      } else {
        totalExpense += amount;
        // Effective bucket: own bucket → parent bucket → unclassified
        const bucket = (tx.category?.bucket ?? tx.category?.parent?.bucket ?? null) as
          | "NEEDS" | "WANTS" | "SAVINGS" | null;
        bucketTotals[bucket ?? "unclassified"] += amount;
      }

      const targetMap = tx.type === "EXPENSE" ? categoryMap : incomeCategoryMap;
      updateCategoryMap(targetMap, tx.category, amount);
    }

    return NextResponse.json({
      year,
      month,
      currencyCode: defaultCurrency?.code ?? null,
      currencySymbol: defaultCurrency?.symbol ?? null,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      net: Math.round((totalIncome - totalExpense) * 100) / 100,
      categories: mapToSortedArray(categoryMap),
      incomeCategories: mapToSortedArray(incomeCategoryMap),
      bucketBreakdown: {
        NEEDS: Math.round(bucketTotals.NEEDS * 100) / 100,
        WANTS: Math.round(bucketTotals.WANTS * 100) / 100,
        SAVINGS: Math.round(bucketTotals.SAVINGS * 100) / 100,
        unclassified: Math.round(bucketTotals.unclassified * 100) / 100,
      },
    });
  } catch (error) {
    console.error("GET /api/summary/monthly error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
