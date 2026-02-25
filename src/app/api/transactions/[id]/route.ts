// API: GET/PUT/DELETE /api/transactions/[id]
// ==========================================
// Dynamic route — the [id] folder name means the URL segment is
// a parameter. /api/transactions/abc-123 → params.id = "abc-123"
//
// In Next.js 16, route params are passed as a Promise that must
// be awaited (this changed from earlier versions where params
// was a plain object).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema } from "@/validators/transaction";

// The include object is reused across GET and PUT to ensure
// consistent response shape.
const transactionInclude = {
  fromAccount: { include: { currency: true } },
  category: { include: { parent: true } },
} as const;

// GET /api/transactions/[id] — Fetch a single transaction
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: transactionInclude,
    });

    if (!transaction) {
      return NextResponse.json(
        { error: { message: "Transaction not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("GET /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

// PUT /api/transactions/[id] — Update a transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if the transaction exists first
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Transaction not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const parsed = updateTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid transaction data",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        type: data.type,
        amount: data.amount,
        description: data.description,
        friendlyName: data.friendlyName,
        notes: data.notes,
        date: data.date,
        fromAccountId: data.fromAccountId,
        categoryId: data.categoryId ?? undefined,
        needsReview: data.needsReview,
      },
      include: transactionInclude,
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("PUT /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions/[id] — Delete a transaction
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Transaction not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    // Hard delete — transactions don't use soft-delete.
    // We could add soft-delete later if needed (add isDeleted flag).
    await prisma.transaction.delete({ where: { id } });

    // 204 No Content — standard response for successful deletion.
    // No response body needed.
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
