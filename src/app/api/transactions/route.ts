// API: GET /api/transactions — List transactions (with filters + pagination)
// API: POST /api/transactions — Create a new transaction
// =====================================================================
// Route Handlers are the App Router's way of creating API endpoints.
// You export functions named after HTTP methods (GET, POST, PUT, DELETE).
// Next.js calls the right function based on the request method.
//
// The `request` parameter is a standard Web API Request object.
// The `NextResponse` is a helper for creating Response objects with
// convenience methods like `.json()`.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import {
  createTransactionSchema,
  transactionQuerySchema,
} from "@/validators/transaction";
import { Prisma } from "@/generated/prisma/client";
import { resolveExchangeRateFields } from "@/lib/resolve-exchange-rate";

// Shared include — used by both findMany and the POST response.
// Including splits lets the client render the split badge and categories
// without a second request.
const transactionInclude = {
  fromAccount: { include: { currency: true } },
  category: { include: { parent: true } },
  splits: { include: { category: { include: { parent: true } } } },
} as const;

// Accepts both dot ("20.01") and comma ("20,01") as the decimal separator so
// the search bar works regardless of the user's locale setting.
// Returns null for anything that isn't a valid positive number.
function parseSearchAmount(search: string): number | null {
  const trimmed = search.trim();
  const direct = Number(trimmed);
  if (!isNaN(direct) && isFinite(direct) && direct > 0) return direct;
  const withDot = Number(trimmed.replace(",", "."));
  if (!isNaN(withDot) && isFinite(withDot) && withDot > 0) return withDot;
  return null;
}

// Builds the OR condition for a search term: description, friendlyName,
// and — when the term parses as a positive number — exact amount match.
// Extracted to keep GET's cognitive complexity within SonarCloud limits.
function buildSearchCondition(search: string): Prisma.TransactionWhereInput {
  const orConditions: Prisma.TransactionWhereInput[] = [
    { description: { contains: search, mode: "insensitive" } },
    { friendlyName: { contains: search, mode: "insensitive" } },
  ];
  const amountValue = parseSearchAmount(search);
  if (amountValue !== null) {
    orConditions.push({ amount: { equals: new Prisma.Decimal(amountValue) } });
  }
  return { OR: orConditions };
}

// GET /api/transactions?page=1&limit=20&type=EXPENSE&startDate=2026-01-01
export async function GET(request: NextRequest) {
  try {
    // request.nextUrl.searchParams gives you the URL query parameters.
    // We convert them to a plain object for Zod to validate.
    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );

    // Validate and parse query parameters.
    // safeParse returns { success: true, data } or { success: false, error }
    // instead of throwing — we handle errors gracefully.
    const parsed = transactionQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid query parameters",
            code: "VALIDATION_ERROR",
            details: z.flattenError(parsed.error).fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { page, limit, type, accountId, categoryId, startDate, endDate, search, needsReview } =
      parsed.data;

    // Build a dynamic Prisma `where` filter.
    // Only include conditions for parameters that were provided.
    // parentTransactionId: null ensures we only show top-level transactions —
    // split children live nested under their parent and are not shown separately.
    const where: Prisma.TransactionWhereInput = {
      parentTransactionId: null,
    };

    if (type) where.type = type;
    if (needsReview !== undefined) where.needsReview = needsReview;

    // Search, accountId, and categoryId all use OR conditions or complex logic.
    // We wrap each in a separate AND clause so they combine correctly.
    // Without this, two top-level OR arrays would overwrite each other.
    const andConditions: Prisma.TransactionWhereInput[] = [];

    if (search) {
      andConditions.push(buildSearchCondition(search));
    }
    if (accountId) {
      where.fromAccountId = accountId;
    }
    if (categoryId === "uncategorized") {
      // Show transactions with no category and no splits, excluding TRANSFER.
      // TRANSFER transactions have no category by design — they are not missing
      // one. Only INCOME/EXPENSE transactions with no category need attention.
      andConditions.push({ categoryId: null, splits: { none: {} }, type: { not: "TRANSFER" } });
    } else if (categoryId) {
      // For split transactions the parent has no categoryId, but its children do.
      // We match if the transaction itself has the category OR if any of its
      // splits do — so split parents appear when filtering by a split category.
      andConditions.push({
        OR: [
          { categoryId },
          { splits: { some: { categoryId } } },
        ],
      });
    }
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    // Run count and findMany in parallel using Promise.all.
    // This is faster than running them sequentially because both
    // queries go to the database at the same time.
    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        // Pagination: skip = how many to skip, take = how many to return.
        // Page 1 skips 0, page 2 skips `limit`, page 3 skips `limit * 2`.
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

// POST /api/transactions — Create a new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid transaction data",
            code: "VALIDATION_ERROR",
            details: z.flattenError(parsed.error).fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const hasSplits = data.splits && data.splits.length >= 2;

    // Resolve exchange rate before the DB write so network errors surface cleanly.
    const rateFields = await resolveExchangeRateFields(
      data.fromAccountId,
      data.amount,
      data.date,
      data.exchangeRate
    );

    let transaction;

    if (hasSplits) {
      // prisma.$transaction() is a DB transaction — all writes succeed or fail
      // together. If creating the second split fails, the first is rolled back.
      transaction = await prisma.$transaction(async (tx) => {
        // Create the parent — no categoryId (covered by splits)
        const parent = await tx.transaction.create({
          data: {
            type: data.type,
            amount: data.amount,
            description: data.description,
            friendlyName: data.friendlyName,
            notes: data.notes,
            date: data.date,
            fromAccountId: data.fromAccountId,
            categoryId: null,
            needsReview: data.needsReview ?? false,
            ...rateFields,
          },
        });

        // Create each split child linked to the parent
        await tx.transaction.createMany({
          data: data.splits!.map((split) => ({
            type: data.type,
            amount: split.amount,
            date: data.date,
            fromAccountId: data.fromAccountId,
            categoryId: split.categoryId,
            parentTransactionId: parent.id,
          })),
        });

        // Re-fetch with full includes for the response
        return tx.transaction.findUniqueOrThrow({
          where: { id: parent.id },
          include: transactionInclude,
        });
      });
    } else {
      // Simple (non-split) transaction — original path
      transaction = await prisma.transaction.create({
        data: {
          type: data.type,
          amount: data.amount,
          description: data.description,
          friendlyName: data.friendlyName,
          notes: data.notes,
          date: data.date,
          fromAccountId: data.fromAccountId,
          categoryId: data.categoryId ?? undefined,
          needsReview: data.needsReview ?? false,
          ...rateFields,
        },
        include: transactionInclude,
      });
    }

    // 201 Created — the standard HTTP status for successful resource creation
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("POST /api/transactions error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
