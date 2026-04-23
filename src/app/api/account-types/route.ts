// API: GET/POST /api/account-types
// =================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccountTypeSchema } from "@/validators/account-type";
import { z } from "zod/v4";

export async function GET() {
  try {
    const accountTypes = await prisma.accountType.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: accountTypes });
  } catch (error) {
    console.error("GET /api/account-types error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createAccountTypeSchema.safeParse(body);

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

    const accountType = await prisma.accountType.create({ data: parsed.data });
    return NextResponse.json(accountType, { status: 201 });
  } catch (error) {
    console.error("POST /api/account-types error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
