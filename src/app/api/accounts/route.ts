// API: GET/POST /api/accounts
// ============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/validators/account";

export async function GET(request: NextRequest) {
  try {
    // Optional query param to include inactive accounts
    const showAll = request.nextUrl.searchParams.get("all") === "true";

    const accounts = await prisma.account.findMany({
      where: showAll ? {} : { isActive: true },
      include: { currency: true, accountType: true },
      orderBy: { name: "asc" },
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
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: parsed.data,
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
