// API: /api/budgets
// =================
// GET  — list all budget entries for a year (?year=2026)
// POST — bulk upsert budget entries for a year
//
// Upsert means "update if exists, create if not". This is perfect
// for budgets because the user just sets amounts — they don't care
// whether the record already exists. Prisma's upsert() method
// handles this atomically using the unique [year, categoryId] constraint.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkUpsertBudgetSchema } from "@/validators/budget";

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

    const budgets = await prisma.budget.findMany({
      where: { year },
      include: {
        category: {
          include: { parent: true },
        },
      },
      orderBy: { category: { name: "asc" } },
    });

    return NextResponse.json({ data: budgets });
  } catch (error) {
    console.error("GET /api/budgets error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

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

    // Use a Prisma transaction to upsert all budgets atomically.
    // If any one fails, they all roll back.
    await prisma.$transaction(
      budgets.map((b) =>
        prisma.budget.upsert({
          where: {
            // This uses the @@unique([year, categoryId]) constraint
            year_categoryId: {
              year,
              categoryId: b.categoryId,
            },
          },
          update: { amount: b.amount },
          create: {
            year,
            categoryId: b.categoryId,
            amount: b.amount,
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
