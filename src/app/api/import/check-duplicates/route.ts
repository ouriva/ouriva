// API: POST /api/import/check-duplicates
// =======================================
// Accepts an array of importRef strings and returns which ones
// already exist in the database. This powers the "duplicate" badges
// in the review step of the import wizard.
//
// Why a separate endpoint? The client generates importRefs locally
// (using the column mapping + occurrence counters) and then checks
// them in bulk. This avoids sending the full file data again.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDuplicatesSchema } from "@/validators/import";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = checkDuplicatesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { importRefs } = parsed.data;

    // Find which importRefs already exist in the Transaction table.
    // We only select the importRef field — no need to load full transactions.
    const existing = await prisma.transaction.findMany({
      where: { importRef: { in: importRefs } },
      select: { importRef: true },
    });

    // Return as a Set-friendly array of strings
    const duplicates = existing
      .map((t) => t.importRef)
      .filter((ref): ref is string => ref !== null);

    return NextResponse.json({ data: { duplicates } });
  } catch (error) {
    console.error("POST /api/import/check-duplicates error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
