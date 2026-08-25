// API: POST /api/budgets/[year]/copy
// ===================================
// Copies every Budget row from `year - 1` into `year`, replacing whatever
// was there before. `year` in the URL is the TARGET year; the source is
// always the previous year — the request has no body.
//
// This is a destructive operation: any target-year budget entry not
// present in the source year is deleted, not just left alone, so the
// result is an exact mirror of the source year's category set (amount +
// note copied verbatim per category).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

class EmptySourceYearError extends Error {
  constructor(public sourceYear: number) {
    super(`No budget found for ${sourceYear}`);
    this.name = "EmptySourceYearError";
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year: yearParam } = await params;
    const targetYear = Number.parseInt(yearParam);

    if (Number.isNaN(targetYear)) {
      return NextResponse.json(
        { error: { message: "Invalid year", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const sourceYear = targetYear - 1;

    const copiedCount = await prisma.$transaction(async (tx) => {
      const sourceBudgets = await tx.budget.findMany({
        where: { year: sourceYear },
        select: { categoryId: true, amount: true, note: true },
      });

      if (sourceBudgets.length === 0) {
        throw new EmptySourceYearError(sourceYear);
      }

      await tx.budget.deleteMany({ where: { year: targetYear } });

      await tx.budget.createMany({
        data: sourceBudgets.map((b) => ({
          year: targetYear,
          categoryId: b.categoryId,
          amount: b.amount,
          note: b.note,
        })),
      });

      return sourceBudgets.length;
    });

    return NextResponse.json({ success: true, copiedCount });
  } catch (error) {
    if (error instanceof EmptySourceYearError) {
      return NextResponse.json(
        {
          error: {
            message: `No budget found for ${error.sourceYear}`,
            code: "EMPTY_SOURCE_YEAR",
          },
        },
        { status: 400 }
      );
    }

    console.error("POST /api/budgets/[year]/copy error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
