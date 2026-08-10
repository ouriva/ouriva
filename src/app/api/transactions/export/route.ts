// API: GET /api/transactions/export — Download all matching transactions as CSV
// =============================================================================
// Accepts the same filter query params as GET /api/transactions (minus
// pagination), fetches all matching transactions, and streams back a CSV file.
//
// CSV design decisions:
//   - Split transactions are expanded: one row per split child (not the parent).
//     This makes the data flat and directly usable in spreadsheets/pivot tables.
//   - Regular transactions: one row per transaction.
//   - Amount is always positive; Type column (INCOME/EXPENSE) indicates direction.
//   - Columns: Date, Type, Amount, Currency, Description, Category, Account, Notes
//
// CSV encoding:
//   - Fields containing commas, quotes, or newlines are wrapped in double-quotes.
//   - Internal double-quotes are escaped as "".
//   - File is UTF-8 with BOM (\uFEFF) so Excel auto-detects the encoding.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { transactionQuerySchema } from "@/validators/transaction";
import { Prisma } from "@/generated/prisma/client";

// Escape a value for inclusion in a CSV cell.
// Wraps in quotes if the value contains commas, quotes, or newlines.
function csvEscape(value: string | null | undefined = ""): string {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

// Build one CSV row from an array of values.
function csvRow(cells: (string | null | undefined)[]): string {
  return cells.map(csvEscape).join(",");
}

// Format a category into a display string (e.g. "Food > Groceries").
function formatCategory(
  category: { name: string; parent?: { name: string } | null } | null | undefined
): string {
  if (!category) return "";
  return category.parent
    ? `${category.parent.name} > ${category.name}`
    : category.name;
}

// Build the Prisma where clause from validated query params.
function buildWhereClause(params: {
  type?: string;
  needsReview?: boolean;
  accountId?: string;
  categoryId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { parentTransactionId: null };

  if (params.type) where.type = params.type as "INCOME" | "EXPENSE" | "TRANSFER";
  if (params.needsReview !== undefined) where.needsReview = params.needsReview;

  const andConditions: Prisma.TransactionWhereInput[] = [];

  if (params.search) {
    andConditions.push({
      OR: [
        { description: { contains: params.search, mode: "insensitive" } },
        { friendlyName: { contains: params.search, mode: "insensitive" } },
      ],
    });
  }
  if (params.accountId) where.fromAccountId = params.accountId;
  if (params.categoryId === "uncategorized") {
    // Exclude TRANSFER — same logic as the main transactions list.
    // TRANSFER without a category is a data anomaly, not a missing categorisation.
    andConditions.push({ categoryId: null, splits: { none: {} }, type: { not: "TRANSFER" } });
  } else if (params.categoryId) {
    andConditions.push({
      OR: [
        { categoryId: params.categoryId },
        { splits: { some: { categoryId: params.categoryId } } },
      ],
    });
  }
  if (andConditions.length > 0) where.AND = andConditions;
  if (params.startDate || params.endDate) {
    where.date = {};
    if (params.startDate) where.date.gte = params.startDate;
    if (params.endDate) where.date.lte = params.endDate;
  }

  return where;
}

// Build all CSV data rows from a list of fetched transactions.
function buildCsvRows(transactions: {
  date: Date;
  type: string;
  amount: unknown;
  notes?: string | null;
  friendlyName?: string | null;
  description?: string | null;
  fromAccount: { name: string; currency: { code: string } };
  category: { name: string; parent?: { name: string } | null } | null;
  splits: { amount: unknown; category: { name: string; parent?: { name: string } | null } | null }[];
}[]): string[] {
  const rows: string[] = [];
  for (const tx of transactions) {
    const date = tx.date.toISOString().split("T")[0];
    const account = tx.fromAccount.name;
    const currency = tx.fromAccount.currency.code;
    const description = tx.friendlyName ?? tx.description ?? "";
    const notes = tx.notes ?? "";
    if (tx.splits.length > 0) {
      for (const split of tx.splits) {
        rows.push(csvRow([date, tx.type, Number(split.amount).toFixed(2), currency, description, formatCategory(split.category), account, notes]));
      }
    } else {
      rows.push(csvRow([date, tx.type, Number(tx.amount).toFixed(2), currency, description, formatCategory(tx.category), account, notes]));
    }
  }
  return rows;
}

// GET /api/transactions/export?type=EXPENSE&startDate=2026-01-01&...
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );

    // Reuse the same validator as the list endpoint, ignoring pagination fields.
    const parsed = transactionQuerySchema.safeParse({
      ...searchParams,
      page: "1",
      limit: "1", // ignored — we fetch all below
    });

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

    const { type, accountId, categoryId, startDate, endDate, search, needsReview } =
      parsed.data;

    const where = buildWhereClause({ type, accountId, categoryId, startDate, endDate, search, needsReview });

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        fromAccount: { include: { currency: true } },
        category: { include: { parent: true } },
        splits: {
          include: { category: { include: { parent: true } } },
          orderBy: { amount: "desc" },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    // ── Build CSV ──────────────────────────────────────────────────────────
    const header = csvRow(["Date", "Type", "Amount", "Currency", "Description", "Category", "Account", "Notes"]);
    const rows = buildCsvRows(transactions);

    // UTF-8 BOM ensures Excel recognises the encoding automatically.
    const csv = "\uFEFF" + [header, ...rows].join("\n");

    // Generate a filename that reflects any active date filter.
    const filenameParts = ["transactions"];
    if (startDate) filenameParts.push(String(startDate).slice(0, 10));
    if (endDate) filenameParts.push(String(endDate).slice(0, 10));
    const filename = filenameParts.join("_") + ".csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/transactions/export error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
