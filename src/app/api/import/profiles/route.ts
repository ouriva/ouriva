// API: GET/POST /api/import/profiles
// ====================================
// GET  — list all saved import profiles
// POST — create a new import profile
//
// Import profiles store column mappings so users don't need to
// re-map columns every time they import from the same bank.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { createImportProfileSchema } from "@/validators/import";

export async function GET() {
  try {
    const profiles = await prisma.importProfile.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: profiles });
  } catch (error) {
    console.error("GET /api/import/profiles error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createImportProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details: z.treeifyError(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const profile = await prisma.importProfile.create({
      data: parsed.data,
    });

    return NextResponse.json({ data: profile }, { status: 201 });
  } catch (error) {
    console.error("POST /api/import/profiles error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
