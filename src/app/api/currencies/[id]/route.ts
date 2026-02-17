// API: PUT/DELETE /api/currencies/[id]
// ====================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateCurrencySchema } from "@/validators/currency";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCurrencySchema.safeParse(body);

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

    const currency = await prisma.currency.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(currency);
  } catch (error) {
    console.error("PUT /api/currencies/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if any accounts use this currency
    const accountCount = await prisma.account.count({
      where: { currencyId: id },
    });

    if (accountCount > 0) {
      return NextResponse.json(
        {
          error: {
            message: `Cannot delete currency — ${accountCount} account(s) still use it`,
            code: "CONSTRAINT_ERROR",
          },
        },
        { status: 409 } // 409 Conflict
      );
    }

    await prisma.currency.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/currencies/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
