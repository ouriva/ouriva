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
import { getExcludedCategoryIds } from "@/lib/settings";
import { getDefaultCurrency } from "@/lib/default-currency";
import {
  type CategoryEntry,
  effectiveAmount,
  updateCategoryMap,
  fetchSummaryTransactions,
  initBucketTotals,
  addToBucket,
  roundBucketTotals,
} from "@/lib/summary-helpers";

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

    const transactions = await fetchSummaryTransactions(startDate, endDate, excludedCategoryIds);

    let totalIncome = 0;
    let totalExpense = 0;

    // 50/30/20 bucket breakdown — expenses only.
    // Effective bucket = category.bucket ?? parent.bucket ?? null (unclassified).
    const bucketTotals = initBucketTotals();

    // Group by category for the breakdown.
    // We group by PARENT category — if a transaction has a child
    // category, we roll it up to the parent.
    // Two separate maps: one for expenses, one for income.
    const categoryMap = new Map<string, CategoryEntry>();
    const incomeCategoryMap = new Map<string, CategoryEntry>();

    for (const tx of transactions) {
      const amount = effectiveAmount(tx, defaultCurrency);

      // Route by category type, not transaction type.
      // INCOME transactions in EXPENSE categories are reimbursements — they
      // reduce that category's expense total rather than polluting the income tab.
      // Symmetrically, EXPENSE transactions in INCOME categories are contra-income
      // (refund/correction of income already received) and reduce that category's
      // income total instead of appearing as a new expense.
      const categoryType = tx.category?.type ?? (tx.type === "INCOME" ? "INCOME" : "EXPENSE");
      const displayAmount = categoryType !== tx.type ? -amount : amount;
      const targetMap = categoryType === "EXPENSE" ? categoryMap : incomeCategoryMap;

      // Totals and the 50/30/20 bucket breakdown use the same netted
      // displayAmount as the category maps, so they always reconcile with
      // the category breakdown tables (NEEDS + WANTS + SAVINGS + unclassified
      // sums to totalExpense).
      if (categoryType === "EXPENSE") {
        totalExpense += displayAmount;
        addToBucket(bucketTotals, tx.category, displayAmount);
      } else {
        totalIncome += displayAmount;
      }
      updateCategoryMap(targetMap, tx.category, displayAmount);
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
      bucketBreakdown: roundBucketTotals(bucketTotals),
    });
  } catch (error) {
    console.error("GET /api/summary/monthly error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
