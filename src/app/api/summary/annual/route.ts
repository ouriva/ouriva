// API: GET /api/summary/annual?year=2026
// =======================================
// Returns monthly income/expense totals for a full year (12 months)
// plus per-category annual totals. Used by the annual bar chart
// and category breakdown table.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getExcludedCategoryIds } from "@/lib/settings";
import { getDefaultCurrency } from "@/lib/default-currency";
import { type CategoryEntry, effectiveAmount, updateCategoryMap } from "@/lib/summary-helpers";

function mapToSortedArray(map: Map<string, CategoryEntry>) {
  return Array.from(map.values())
    .map((cat) => ({
      ...cat,
      total: Math.round(cat.total * 100) / 100,
      months: (cat.months ?? []).map((m) => Math.round(m * 100) / 100),
      children: Array.from(cat.children.values())
        .map((c) => ({
          ...c,
          total: Math.round(c.total * 100) / 100,
          months: (c.months ?? []).map((m) => Math.round(m * 100) / 100),
        }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
}

export async function GET(request: NextRequest) {
  try {
    const yearParam = request.nextUrl.searchParams.get("year");

    if (!yearParam) {
      return NextResponse.json(
        { error: { message: "year is required", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);
    const startDate = new Date(year, 0, 1);  // Jan 1
    const endDate = new Date(year, 11, 31);  // Dec 31

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

    // Build monthly breakdown (12 months)
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0,
    }));

    // Build category breakdown — separate maps for expenses and income
    const categoryMap = new Map<string, CategoryEntry>();
    const incomeCategoryMap = new Map<string, CategoryEntry>();

    let totalIncome = 0;
    let totalExpense = 0;

    // 50/30/20 bucket breakdown — expenses only.
    // Effective bucket = category.bucket ?? parent.bucket ?? null (unclassified).
    const bucketTotals = { NEEDS: 0, WANTS: 0, SAVINGS: 0, unclassified: 0 };

    for (const tx of transactions) {
      const amount = effectiveAmount(tx, defaultCurrency);
      // tx.date is a Date object; getMonth() returns 0-11
      const monthIndex = new Date(tx.date).getMonth();

      if (tx.type === "INCOME") {
        months[monthIndex].income += amount;
        totalIncome += amount;
      } else {
        months[monthIndex].expense += amount;
        totalExpense += amount;
        // Effective bucket: own bucket → parent bucket → unclassified
        const bucket = (tx.category?.bucket ?? tx.category?.parent?.bucket ?? null) as
          | "NEEDS" | "WANTS" | "SAVINGS" | null;
        bucketTotals[bucket ?? "unclassified"] += amount;
      }

      const targetMap = tx.type === "EXPENSE" ? categoryMap : incomeCategoryMap;
      updateCategoryMap(targetMap, tx.category, amount, monthIndex);
    }

    // Round all values and convert maps to arrays
    const roundedMonths = months.map((m) => ({
      ...m,
      income: Math.round(m.income * 100) / 100,
      expense: Math.round(m.expense * 100) / 100,
      net: Math.round((m.income - m.expense) * 100) / 100,
    }));

    return NextResponse.json({
      year,
      currencyCode: defaultCurrency?.code ?? null,
      currencySymbol: defaultCurrency?.symbol ?? null,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      net: Math.round((totalIncome - totalExpense) * 100) / 100,
      months: roundedMonths,
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
    console.error("GET /api/summary/annual error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
