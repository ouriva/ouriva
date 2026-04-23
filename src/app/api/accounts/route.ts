// API: GET/POST /api/accounts
// ============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { createAccountSchema } from "@/validators/account";

export async function GET(request: NextRequest) {
  try {
    // Optional query param to include inactive accounts
    const showAll = request.nextUrl.searchParams.get("all") === "true";

    const accounts = await prisma.account.findMany({
      where: showAll ? {} : { isActive: true },
      include: { currency: true, accountType: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data: accounts });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);

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

    // Place the new account at the end of the list
    const maxOrder = await prisma.account.aggregate({ _max: { sortOrder: true } });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const account = await prisma.account.create({
      data: { ...parsed.data, sortOrder: nextOrder },
      include: { currency: true, accountType: true },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
