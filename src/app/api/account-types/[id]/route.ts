// API: PUT/DELETE /api/account-types/[id]
// ========================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { updateAccountTypeSchema } from "@/validators/account-type";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateAccountTypeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid account type data",
            code: "VALIDATION_ERROR",
            details: z.flattenError(parsed.error).fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const accountType = await prisma.accountType.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(accountType);
  } catch (error) {
    console.error("PUT /api/account-types/[id] error:", error);
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

    const accountCount = await prisma.account.count({
      where: { accountTypeId: id },
    });

    if (accountCount > 0) {
      return NextResponse.json(
        {
          error: {
            message: `Cannot delete account type — ${accountCount} account(s) still use it`,
            code: "CONSTRAINT_ERROR",
          },
        },
        { status: 409 }
      );
    }

    await prisma.accountType.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/account-types/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
