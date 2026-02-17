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
import {
  createTransactionSchema,
  transactionQuerySchema,
} from "@/validators/transaction";
import { Prisma } from "@/generated/prisma/client";

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
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { page, limit, type, accountId, categoryId, startDate, endDate, search } =
      parsed.data;

    // Build a dynamic Prisma `where` filter.
    // Only include conditions for parameters that were provided.
    const where: Prisma.TransactionWhereInput = {};

    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.description = { contains: search, mode: "insensitive" };
    }
    if (accountId) {
      // Show transactions where this account is either the source or destination
      where.OR = [{ fromAccountId: accountId }, { toAccountId: accountId }];
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
        include: {
          fromAccount: { include: { currency: true } },
          toAccount: { include: { currency: true } },
          category: { include: { parent: true } },
        },
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
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const transaction = await prisma.transaction.create({
      data: {
        type: data.type,
        amount: data.amount,
        description: data.description,
        date: data.date,
        fromAccountId: data.fromAccountId,
        // These fields only exist on TRANSFER type.
        // The "in" operator checks if the key exists in the object.
        toAccountId: "toAccountId" in data ? data.toAccountId : undefined,
        toAmount: "toAmount" in data ? data.toAmount : undefined,
        categoryId: data.categoryId ?? undefined,
      },
      include: {
        fromAccount: { include: { currency: true } },
        toAccount: { include: { currency: true } },
        category: { include: { parent: true } },
      },
    });

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
