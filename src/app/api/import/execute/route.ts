// API: POST /api/import/execute
// ==============================
// Bulk creates transactions from the import wizard.
// Uses Prisma's $transaction to ensure atomicity — if any row fails,
// they all roll back. Each transaction includes an importRef for
// future duplicate detection.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeImportSchema } from "@/validators/import";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = executeImportSchema.safeParse(body);

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

    const { transactions } = parsed.data;

    // Bulk create using $transaction for atomicity.
    // We use createMany instead of individual creates for performance —
    // it generates a single INSERT statement with multiple VALUES.
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.createMany({
        data: transactions.map((t) => ({
          type: t.type,
          amount: t.amount,
          description: t.description || null,
          date: new Date(t.date),
          fromAccountId: t.fromAccountId,
          categoryId: t.categoryId || null,
          importRef: t.importRef,
        })),
        skipDuplicates: true, // Skip rows with duplicate importRef
      });
      return created;
    });

    return NextResponse.json({
      data: {
        imported: result.count,
        total: transactions.length,
      },
    });
  } catch (error) {
    console.error("POST /api/import/execute error:", error);
    return NextResponse.json(
      { error: { message: "Failed to import transactions", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
