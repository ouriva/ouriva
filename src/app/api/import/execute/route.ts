// API: POST /api/import/execute
// ==============================
// Bulk creates transactions from the import wizard.
// Uses Prisma's $transaction to ensure atomicity — if any row fails,
// they all roll back. Each transaction includes an importRef for
// future duplicate detection.
//
// Exchange rate resolution:
//   Before writing to the DB, we batch-resolve exchange rates for all rows.
//   The module-level cache in exchange-rate.ts means each unique date+pair
//   is only fetched once from Frankfurter, even across hundreds of rows.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeImportSchema } from "@/validators/import";
import { getDefaultCurrency } from "@/lib/default-currency";
import { fetchExchangeRate, applyExchangeRate } from "@/lib/exchange-rate";

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

    // Resolve exchange rates before the DB write.
    // Look up the default currency and account currencies once, then
    // batch-fetch rates per unique date (cached within this request).
    const defaultCurrency = await getDefaultCurrency();
    const defaultCode = defaultCurrency?.code ?? null;

    const accountIds = [...new Set(transactions.map((t) => t.fromAccountId))];
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, currency: { select: { code: true } } },
    });
    const accountCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency.code]));

    const ratesByIndex = await Promise.all(
      transactions.map(async (t) => {
        const accountCode = accountCurrencyMap.get(t.fromAccountId) ?? null;
        if (!defaultCode || !accountCode || accountCode === defaultCode) {
          return { exchangeRate: null, baseCurrencyAmount: null };
        }
        const rate = t.exchangeRate ?? await fetchExchangeRate(t.date, accountCode, defaultCode);
        return {
          exchangeRate: rate,
          baseCurrencyAmount: applyExchangeRate(Number(t.amount), rate),
        };
      })
    );

    // Bulk create using $transaction for atomicity.
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.createMany({
        data: transactions.map((t, i) => ({
          type: t.type,
          amount: t.amount,
          description: t.description || null,
          friendlyName: t.friendlyName || null,
          notes: t.notes || null,
          date: new Date(t.date),
          fromAccountId: t.fromAccountId,
          categoryId: t.categoryId || null,
          importRef: t.importRef,
          needsReview: t.needsReview ?? false,
          exchangeRate: ratesByIndex[i].exchangeRate,
          baseCurrencyAmount: ratesByIndex[i].baseCurrencyAmount,
        })),
        skipDuplicates: true,
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
