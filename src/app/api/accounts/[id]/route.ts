// API: GET/PUT/DELETE /api/accounts/[id]
// ======================================
// Soft-delete via isActive flag — accounts are never truly deleted
// because historical transactions reference them.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateAccountSchema } from "@/validators/account";
import { z } from "zod/v4";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await prisma.account.findUnique({
      where: { id },
      include: { currency: true, accountType: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: { message: "Account not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("GET /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid account data",
            code: "VALIDATION_ERROR",
            details: z.flattenError(parsed.error).fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const existing = await prisma.account.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Account not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const account = await prisma.account.update({
      where: { id },
      data: parsed.data,
      include: { currency: true, accountType: true },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("PUT /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

// DELETE performs a soft-delete — sets isActive to false.
// The account remains in the database for historical reference.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.account.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Account not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    await prisma.account.update({
      where: { id },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
