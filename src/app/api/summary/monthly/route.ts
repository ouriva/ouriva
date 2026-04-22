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
import { type CategoryEntry, effectiveAmount, updateCategoryMap } from "@/lib/summary-helpers";

function mapToSortedArray(map: Map<string, CategoryEntry>) {
  return Array.from(map.values())
    .map((cat) => ({
      ...cat,
      children: Array.from(cat.children.values()).toSorted((a, b) => b.total - a.total),
    }))
    .toSorted((a, b) => b.total - a.total);
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

    const year = Number.parseInt(yearParam);
    const month = Number.parseInt(monthParam);

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
