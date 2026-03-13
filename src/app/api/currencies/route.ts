// API: GET/POST /api/currencies
// ==============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCurrencySchema } from "@/validators/currency";

export async function GET() {
  try {
    const currencies = await prisma.currency.findMany({
      orderBy: { code: "asc" },
    });
    return NextResponse.json({ data: currencies });
  } catch (error) {
    console.error("GET /api/currencies error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createCurrencySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid currency data",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    // If this is the first currency ever created, make it the default automatically.
    // We check inside a transaction so concurrent creates don't both think they're first.
    const currency = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.currency.count();
      return tx.currency.create({
        data: { ...parsed.data, isDefault: existingCount === 0 },
      });
    });
    return NextResponse.json(currency, { status: 201 });
  } catch (error) {
    console.error("POST /api/currencies error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
