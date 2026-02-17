// API: GET /api/accounts — List all active accounts
// =================================================
// Simple endpoint returning accounts with their currency info.
// Used by the transaction form to populate account dropdowns.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
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
