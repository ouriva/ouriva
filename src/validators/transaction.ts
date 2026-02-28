// Transaction Validation Schemas
// ==============================
// Zod schemas define the "shape" of valid data. They serve two purposes:
//   1. Runtime validation — catch bad data from API requests
//   2. Type inference — generate TypeScript types automatically
//
// We use a DISCRIMINATED UNION for transaction types:
//   - INCOME requires: fromAccountId
//   - EXPENSE requires: fromAccountId

import { z } from "zod/v4";

// --- Split entry ---
// Each split assigns a category and amount to a portion of the parent total.

const splitEntrySchema = z.object({
  categoryId: z.string().uuid("Invalid category"),
  amount: z
    .number()
    .positive("Split amount must be positive")
    .multipleOf(0.01, "Split amount can have at most 2 decimal places"),
});

// --- Shared fields ---
// These are common to all transaction types. We define them once
// and spread them into each variant to avoid repetition (DRY).

const baseTransactionFields = {
  amount: z
    .number()
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
  description: z.string().max(255).optional(),
  friendlyName: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  date: z.coerce.date(),
  needsReview: z.boolean().optional(),
  // Optional array of splits. When provided, categoryId on the parent is ignored
  // and must be null. Splits must have ≥ 2 entries and sum to the parent amount.
  splits: z.array(splitEntrySchema).optional(),
};

// --- Cross-field validation helper ---
// superRefine lets us validate across multiple fields at once.
// We use integer cent arithmetic to avoid IEEE 754 float drift
// (e.g. 0.1 + 0.2 === 0.30000000000000004, not 0.3).

function validateSplits(
  data: { amount: number; splits?: { amount: number }[] },
  ctx: z.RefinementCtx
) {
  if (!data.splits || data.splits.length === 0) return;

  if (data.splits.length < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["splits"],
      message: "At least 2 splits are required",
    });
    return;
  }

  const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
  if (Math.round(splitTotal * 100) !== Math.round(data.amount * 100)) {
    ctx.addIssue({
      code: "custom",
      path: ["splits"],
      message: "Split amounts must sum to the total transaction amount",
    });
  }
}

// --- Discriminated union variants ---

const incomeSchema = z
  .object({
    type: z.literal("INCOME"),
    ...baseTransactionFields,
    fromAccountId: z.string().uuid("Invalid account"),
    categoryId: z.string().uuid("Invalid category").optional(),
  })
  .superRefine(validateSplits);

const expenseSchema = z
  .object({
    type: z.literal("EXPENSE"),
    ...baseTransactionFields,
    fromAccountId: z.string().uuid("Invalid account"),
    categoryId: z.string().uuid("Invalid category").optional(),
  })
  .superRefine(validateSplits);

// --- Exported schemas ---

export const createTransactionSchema = z.discriminatedUnion("type", [
  incomeSchema,
  expenseSchema,
]);

// For updates, all fields are optional (partial update / PATCH semantics).
// But we still need the type to know which rules apply.
export const updateTransactionSchema = z.discriminatedUnion("type", [
  incomeSchema.partial().extend({ type: z.literal("INCOME") }),
  expenseSchema.partial().extend({ type: z.literal("EXPENSE") }),
]);

// Query parameters for the GET /api/transactions endpoint.
// All optional — if omitted, returns all transactions.
export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
  needsReview: z.coerce.boolean().optional(),
});

// --- Inferred types ---

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type SplitEntry = z.infer<typeof splitEntrySchema>;
