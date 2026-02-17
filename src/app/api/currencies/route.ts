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

    const currency = await prisma.currency.create({ data: parsed.data });
    return NextResponse.json(currency, { status: 201 });
  } catch (error) {
    console.error("POST /api/currencies error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
