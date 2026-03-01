// API: /api/budgets
// =================
// POST — bulk upsert budget entries for a year.
//
// Each entry now carries a `type` (EXPENSE | INCOME) so income and
// expense budgets can be saved together in one request. The unique
// constraint [year, categoryId, type] allows the same category to
// have both an expense budget and an income budget independently.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
            details: result.error.format(),
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
            year_categoryId_type: {
              year,
              categoryId: b.categoryId,
              type: b.type,
            },
          },
          update: { amount: b.amount, note: b.note ?? null },
          create: {
            year,
            categoryId: b.categoryId,
            type: b.type,
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
