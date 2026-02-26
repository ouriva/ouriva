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
import { getTransferCategoryId } from "@/lib/settings";

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

    // Exclude transfer category from summaries (if configured)
    const transferCategoryId = await getTransferCategoryId();

    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(transferCategoryId && { categoryId: { not: transferCategoryId } }),
      },
      include: {
        category: { include: { parent: true } },
        fromAccount: { include: { currency: true } },
      },
    });

    // Calculate totals
    let totalIncome = 0;
    let totalExpense = 0;

    // Group by category for the breakdown.
    // We group by PARENT category — if a transaction has a child
    // category, we roll it up to the parent.
    // Two separate maps: one for expenses, one for income.
    type CategoryEntry = {
      id: string;
      name: string;
      total: number;
      children: Map<string, { id: string; name: string; total: number }>;
    };
    const categoryMap = new Map<string, CategoryEntry>();
    const incomeCategoryMap = new Map<string, CategoryEntry>();

    for (const tx of transactions) {
      const amount = Number(tx.amount);

      if (tx.type === "INCOME") {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }

      // Build category breakdown for both expenses and income
      const targetMap = tx.type === "EXPENSE" ? categoryMap : incomeCategoryMap;

      if (tx.category) {
        const parentCategory = tx.category.parent || tx.category;
        const isChild = !!tx.category.parent;

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
          if (!parent.children.has(tx.category.id)) {
            parent.children.set(tx.category.id, {
              id: tx.category.id,
              name: tx.category.name,
              total: 0,
            });
          }
          parent.children.get(tx.category.id)!.total += amount;
        }
      } else {
        // Uncategorized — group under a special bucket
        const uncatKey = "__uncategorized__";
        if (!targetMap.has(uncatKey)) {
          targetMap.set(uncatKey, {
            id: uncatKey,
            name: "Uncategorized",
            total: 0,
            children: new Map(),
          });
        }
        targetMap.get(uncatKey)!.total += amount;
      }
    }

    // Convert maps to sorted arrays
    function mapToSortedArray(map: Map<string, CategoryEntry>) {
      return Array.from(map.values())
        .map((cat) => ({
          ...cat,
          children: Array.from(cat.children.values()).sort(
            (a, b) => b.total - a.total
          ),
        }))
        .sort((a, b) => b.total - a.total);
    }

    return NextResponse.json({
      year,
      month,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      net: Math.round((totalIncome - totalExpense) * 100) / 100,
      categories: mapToSortedArray(categoryMap),
      incomeCategories: mapToSortedArray(incomeCategoryMap),
    });
  } catch (error) {
    console.error("GET /api/summary/monthly error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
