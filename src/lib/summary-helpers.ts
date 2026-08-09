// Summary Route Helpers
// =====================
// Shared types and pure functions used by both the monthly and annual
// summary API routes. Centralised here to avoid duplication between
// the two files, which have nearly identical aggregation logic.

import { prisma } from "@/lib/prisma";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DefaultCurrency = { code: string; symbol: string } | null;

// Category shape returned by Prisma's `include: { parent: true }`.
export type TxCategory = {
  id: string;
  name: string;
  type: string;
  parent: { id: string; name: string } | null;
} | null;

// Unified category entry for both routes.
// `months` is populated only by the annual route (12 slots, one per month);
// the monthly route omits it.
export type CategoryEntry = {
  id: string;
  name: string;
  total: number;
  months?: number[];
  children: Map<string, { id: string; name: string; total: number; months?: number[] }>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// When a default currency is set, use baseCurrencyAmount for transactions
// that have been converted (account currency ≠ default). Fall back to
// amount for transactions already in the default currency.
export function effectiveAmount(
  tx: {
    amount: { toString(): string };
    baseCurrencyAmount: { toString(): string } | null;
    fromAccount: { currency: { code: string } };
  },
  defaultCurrency: DefaultCurrency
): number {
  if (!defaultCurrency) return Number(tx.amount);
  if (tx.fromAccount.currency.code === defaultCurrency.code) return Number(tx.amount);
  return tx.baseCurrencyAmount ? Number(tx.baseCurrencyAmount) : Number(tx.amount);
}

// Accumulates a transaction's amount into the correct category entry.
// Rolls child categories up to their parent; groups uncategorised
// transactions under "__uncategorized__".
//
// Pass `monthIndex` (0–11) in the annual route to also accumulate
// per-month totals. Omit it in the monthly route.
export function updateCategoryMap(
  targetMap: Map<string, CategoryEntry>,
  category: TxCategory,
  amount: number,
  monthIndex?: number
): void {
  if (!category) {
    const uncatKey = "__uncategorized__";
    if (!targetMap.has(uncatKey)) {
      targetMap.set(uncatKey, {
        id: uncatKey,
        name: "Uncategorized",
        total: 0,
        ...(monthIndex !== undefined && { months: new Array(12).fill(0) }),
        children: new Map(),
      });
    }
    const uncat = targetMap.get(uncatKey)!;
    uncat.total += amount;
    if (monthIndex !== undefined) uncat.months![monthIndex] += amount;
    return;
  }

  const parentCategory = category.parent ?? category;
  const isChild = !!category.parent;

  if (!targetMap.has(parentCategory.id)) {
    targetMap.set(parentCategory.id, {
      id: parentCategory.id,
      name: parentCategory.name,
      total: 0,
      ...(monthIndex !== undefined && { months: new Array(12).fill(0) }),
      children: new Map(),
    });
  }

  const parent = targetMap.get(parentCategory.id)!;
  parent.total += amount;
  if (monthIndex !== undefined) parent.months![monthIndex] += amount;

  if (isChild) {
    if (!parent.children.has(category.id)) {
      parent.children.set(category.id, {
        id: category.id,
        name: category.name,
        total: 0,
        ...(monthIndex !== undefined && { months: new Array(12).fill(0) }),
      });
    }
    const child = parent.children.get(category.id)!;
    child.total += amount;
    if (monthIndex !== undefined) child.months![monthIndex] += amount;
  }
}

// ─── Bucket helpers ───────────────────────────────────────────────────────────

export type BucketTotals = { NEEDS: number; WANTS: number; SAVINGS: number; unclassified: number };

export function initBucketTotals(): BucketTotals {
  return { NEEDS: 0, WANTS: 0, SAVINGS: 0, unclassified: 0 };
}

// Accumulates `amount` into the correct bucket based on the category's
// bucket field (or its parent's). Used by both the monthly and annual routes.
export function addToBucket(
  bucketTotals: BucketTotals,
  category: { bucket?: string | null; parent?: { bucket?: string | null } | null } | null | undefined,
  amount: number
): void {
  const bucket = (category?.bucket ?? category?.parent?.bucket ?? null) as
    | "NEEDS" | "WANTS" | "SAVINGS" | null;
  bucketTotals[bucket ?? "unclassified"] += amount;
}

export function roundBucketTotals(bt: BucketTotals) {
  return {
    NEEDS: Math.round(bt.NEEDS * 100) / 100,
    WANTS: Math.round(bt.WANTS * 100) / 100,
    SAVINGS: Math.round(bt.SAVINGS * 100) / 100,
    unclassified: Math.round(bt.unclassified * 100) / 100,
  };
}

// ─── Shared Prisma query ──────────────────────────────────────────────────────

// Fetches all transactions for a date range, excluding split parents and
// excluded categories. Include shape is identical for both summary routes.
export async function fetchSummaryTransactions(
  startDate: Date,
  endDate: Date,
  excludedCategoryIds: string[]
) {
  return prisma.transaction.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      // Exclude TRANSFER transactions — they represent inter-account movements
      // and must not appear in income/expense summaries.
      type: { not: "TRANSFER" },
      // Exclude split parents — their total is covered by their children.
      splits: { none: {} },
      ...(excludedCategoryIds.length > 0 && {
        categoryId: { notIn: excludedCategoryIds },
      }),
    },
    include: {
      category: { include: { parent: true } },
      fromAccount: { include: { currency: true } },
    },
  });
}
