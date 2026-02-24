// API: GET /api/budgets/[year]
// ============================
// Returns budget vs actual comparison for a specific year.
// Merges budget records with actual expense totals from transactions.
//
// This is a "merge" operation — we fetch two separate data sources
// (budgets and transactions) and combine them:
//   - Categories with a budget but no expenses → shows 0 actual
//   - Categories with expenses but no budget → shows 0 budgeted
//   - Categories with both → shows both values
//
// The result includes: budgeted amount, actual YTD, remaining,
// and a percentage (actual/budgeted) for progress bar coloring.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransferCategoryId } from "@/lib/settings";

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

    // Exclude transfer category from budget comparisons (if configured)
    const transferCategoryId = await getTransferCategoryId();

    // Fetch budgets and transactions in parallel
    const [budgets, transactions] = await Promise.all([
      prisma.budget.findMany({
        where: {
          year,
          ...(transferCategoryId && { categoryId: { not: transferCategoryId } }),
        },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          type: "EXPENSE",
          ...(transferCategoryId && { categoryId: { not: transferCategoryId } }),
        },
        include: {
          category: { include: { parent: true } },
        },
      }),
    ]);

    // Build a map of actual expenses per PARENT category.
    // Budgets are set at the parent category level, so we roll up
    // child category expenses to their parent.
    const actualMap = new Map<string, number>();

    for (const tx of transactions) {
      if (!tx.category) continue;
      const parentId = tx.category.parent?.id || tx.category.id;
      const current = actualMap.get(parentId) || 0;
      actualMap.set(parentId, current + Number(tx.amount));
    }

    // Build the merged result.
    // Start with all budgeted categories, then add any unbudgeted
    // categories that have actual expenses.
    const resultMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        budgeted: number;
        actual: number;
      }
    >();

    // Add budgeted categories
    for (const budget of budgets) {
      resultMap.set(budget.categoryId, {
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        budgeted: Number(budget.amount),
        actual: actualMap.get(budget.categoryId) || 0,
      });
    }

    // Add unbudgeted categories that have actual expenses
    for (const [categoryId, actual] of actualMap) {
      if (!resultMap.has(categoryId)) {
        // Look up category name — we need to find it from transactions
        const tx = transactions.find((t) => {
          const parentId = t.category?.parent?.id || t.category?.id;
          return parentId === categoryId;
        });
        const categoryName =
          tx?.category?.parent?.name || tx?.category?.name || "Unknown";

        resultMap.set(categoryId, {
          categoryId,
          categoryName,
          budgeted: 0,
          actual,
        });
      }
    }

    // Convert to array with computed fields
    const categories = Array.from(resultMap.values())
      .map((item) => {
        const actual = Math.round(item.actual * 100) / 100;
        const budgeted = Math.round(item.budgeted * 100) / 100;
        const remaining = Math.round((budgeted - actual) * 100) / 100;
        // Percentage of budget used (0 if no budget set)
        const percentage = budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;

        return {
          ...item,
          actual,
          budgeted,
          remaining,
          percentage,
        };
      })
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    // Overall totals
    const totalBudgeted = categories.reduce((sum, c) => sum + c.budgeted, 0);
    const totalActual = categories.reduce((sum, c) => sum + c.actual, 0);

    return NextResponse.json({
      year,
      totalBudgeted: Math.round(totalBudgeted * 100) / 100,
      totalActual: Math.round(totalActual * 100) / 100,
      totalRemaining: Math.round((totalBudgeted - totalActual) * 100) / 100,
      categories,
    });
  } catch (error) {
    console.error("GET /api/budgets/[year] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
