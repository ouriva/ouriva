// API: /api/budgets
// =================
// POST — bulk upsert budget entries for a year.
//
// The unique constraint [year, categoryId] ensures one budget per category
// per year. Which tab (income/expense) a category appears in is determined
// by Category.type, not by any field on the budget entry itself.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { bulkUpsertBudgetSchema } from "@/validators/budget";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = bulkUpsertBudgetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details: z.treeifyError(result.error),
          },
        },
        { status: 400 }
      );
    }

    const { year, budgets } = result.data;

    await prisma.$transaction(
      budgets.map((b) =>
        prisma.budget.upsert({
          where: {
            year_categoryId: {
              year,
              categoryId: b.categoryId,
            },
          },
          update: { amount: b.amount, note: b.note ?? null },
          create: {
            year,
            categoryId: b.categoryId,
            amount: b.amount,
            note: b.note ?? null,
          },
        })
      )
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("POST /api/budgets error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
