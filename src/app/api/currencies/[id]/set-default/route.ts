// API: POST /api/currencies/[id]/set-default
// ===========================================
// Atomically clears isDefault from all currencies then sets it on the
// requested one. Using a DB transaction ensures only one default at a time.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const currency = await prisma.$transaction(async (tx) => {
      // Clear the flag on all currencies first
      await tx.currency.updateMany({ data: { isDefault: false } });
      // Set it on the requested one
      return tx.currency.update({ where: { id }, data: { isDefault: true } });
    });

    return NextResponse.json({ data: currency });
  } catch (error) {
    console.error("POST /api/currencies/[id]/set-default error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
