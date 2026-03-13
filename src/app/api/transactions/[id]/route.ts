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
import { resolveExchangeRateFields } from "@/lib/resolve-exchange-rate";

// The include object is reused across GET and PUT to ensure
// consistent response shape. Splits are included so the form
// can pre-populate split mode when editing a split transaction.
const transactionInclude = {
  fromAccount: { include: { currency: true } },
  category: { include: { parent: true } },
  splits: { include: { category: { include: { parent: true } } } },
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

    // Split children cannot be edited directly — edit the parent instead.
    // This keeps the relationship consistent (amount, date, type all live
    // on the parent; splits just carry category + partial amount).
    if (existing.parentTransactionId !== null) {
      return NextResponse.json(
        {
          error: {
            message: "Split children cannot be edited directly. Edit the parent transaction.",
            code: "FORBIDDEN",
          },
        },
        { status: 400 }
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
    const hasSplits = data.splits && data.splits.length >= 2;

    // Use effective values for rate resolution — fall back to existing when not provided (partial update)
    const effectiveAccountId = data.fromAccountId ?? existing.fromAccountId;
    const effectiveAmount = data.amount ?? Number(existing.amount);
    const effectiveDate = data.date ?? existing.date;

    const rateFields = await resolveExchangeRateFields(
      effectiveAccountId,
      effectiveAmount,
      effectiveDate,
      data.exchangeRate
    );

    let transaction;

    if (hasSplits) {
      // Replace existing splits atomically: delete old, create new.
      // This is simpler than diffing and more reliable for correctness.
      transaction = await prisma.$transaction(async (tx) => {
        // Delete existing splits (there may be none if converting from simple)
        await tx.transaction.deleteMany({
          where: { parentTransactionId: id },
        });

        // Update the parent — no categoryId when splits are present
        const parent = await tx.transaction.update({
          where: { id },
          data: {
            type: data.type,
            amount: data.amount,
            description: data.description,
            friendlyName: data.friendlyName,
            notes: data.notes,
            date: data.date,
            fromAccountId: data.fromAccountId,
            categoryId: null,
            needsReview: data.needsReview,
            ...rateFields,
          },
        });

        // Create new splits
        await tx.transaction.createMany({
          data: data.splits!.map((split) => ({
            type: parent.type,
            amount: split.amount,
            date: parent.date,
            fromAccountId: parent.fromAccountId,
            categoryId: split.categoryId,
            parentTransactionId: parent.id,
          })),
        });

        return tx.transaction.findUniqueOrThrow({
          where: { id },
          include: transactionInclude,
        });
      });
    } else {
      // No splits in the update — converting to a simple transaction.
      // Delete any existing splits first (user removed all splits in the form).
      transaction = await prisma.$transaction(async (tx) => {
        await tx.transaction.deleteMany({
          where: { parentTransactionId: id },
        });

        return tx.transaction.update({
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
            ...rateFields,
          },
          include: transactionInclude,
        });
      });
    }

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

    // Split children are managed through their parent — deleting them
    // directly would leave the parent with an incorrect total.
    if (existing.parentTransactionId !== null) {
      return NextResponse.json(
        {
          error: {
            message: "Split children cannot be deleted directly. Delete the parent transaction.",
            code: "FORBIDDEN",
          },
        },
        { status: 400 }
      );
    }

    // Hard delete — cascade removes all splits automatically (onDelete: Cascade).
    // No need to explicitly delete splits first.
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
