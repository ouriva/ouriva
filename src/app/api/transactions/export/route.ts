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
import { transactionQuerySchema } from "@/validators/transaction";
import { Prisma } from "@/generated/prisma/client";

// Escape a value for inclusion in a CSV cell.
// Wraps in quotes if the value contains commas, quotes, or newlines.
function csvEscape(value: string | null | undefined): string {
  const str = value ?? "";
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Build one CSV row from an array of values.
function csvRow(cells: (string | null | undefined)[]): string {
  return cells.map(csvEscape).join(",");
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
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { type, accountId, categoryId, startDate, endDate, search, needsReview } =
      parsed.data;

    // Build the same where clause as the list endpoint, without pagination.
    const where: Prisma.TransactionWhereInput = {
      parentTransactionId: null,
    };

    if (type) where.type = type;
    if (needsReview !== undefined) where.needsReview = needsReview;

    const andConditions: Prisma.TransactionWhereInput[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { description: { contains: search, mode: "insensitive" } },
          { friendlyName: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (accountId) {
      where.fromAccountId = accountId;
    }
    if (categoryId === "uncategorized") {
      andConditions.push({ categoryId: null, splits: { none: {} } });
    } else if (categoryId) {
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

    const rows: string[] = [];

    for (const tx of transactions) {
      const date = tx.date.toISOString().split("T")[0]; // YYYY-MM-DD
      const type = tx.type;
      const account = tx.fromAccount.name;
      const currency = tx.fromAccount.currency.code;
      // Display name takes priority over raw description
      const description = tx.friendlyName ?? tx.description ?? "";
      const notes = tx.notes ?? "";

      if (tx.splits.length > 0) {
        // Split transaction: emit one row per split child.
        // The parent's amount = sum of splits, so we use split amounts.
        for (const split of tx.splits) {
          const amount = Number(split.amount).toFixed(2);
          const category = split.category
            ? split.category.parent
              ? `${split.category.parent.name} > ${split.category.name}`
              : split.category.name
            : "";
          rows.push(csvRow([date, type, amount, currency, description, category, account, notes]));
        }
      } else {
        // Regular transaction: one row.
        const amount = Number(tx.amount).toFixed(2);
        const category = tx.category
          ? tx.category.parent
            ? `${tx.category.parent.name} > ${tx.category.name}`
            : tx.category.name
          : "";
        rows.push(csvRow([date, type, amount, currency, description, category, account, notes]));
      }
    }

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
