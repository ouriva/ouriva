// API: GET /api/budgets/[year]/exists
// ====================================
// Lightweight existence check — used to decide whether the "copy from
// previous year" button should be enabled, without paying for the full
// aggregated GET /api/budgets/[year] payload just to test for emptiness.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year: yearParam } = await params;
    const year = Number.parseInt(yearParam);

    if (Number.isNaN(year)) {
      return NextResponse.json(
        { error: { message: "Invalid year", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const count = await prisma.budget.count({ where: { year } });

    return NextResponse.json({ hasData: count > 0 });
  } catch (error) {
    console.error("GET /api/budgets/[year]/exists error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
