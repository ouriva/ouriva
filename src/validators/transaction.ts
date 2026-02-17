// Transaction Validation Schemas
// ==============================
// Zod schemas define the "shape" of valid data. They serve two purposes:
//   1. Runtime validation — catch bad data from API requests
//   2. Type inference — generate TypeScript types automatically
//
// We use a DISCRIMINATED UNION for transaction types. This means:
//   - INCOME requires: fromAccountId, categoryId (no toAccountId)
//   - EXPENSE requires: fromAccountId, categoryId (no toAccountId)
//   - TRANSFER requires: fromAccountId, toAccountId (categoryId optional)
//
// This pattern ensures type-specific rules at both the type level
// and runtime validation level.

import { z } from "zod/v4";

// --- Shared fields ---
// These are common to all transaction types. We define them once
// and spread them into each variant to avoid repetition (DRY).

const baseTransactionFields = {
  amount: z
    .number()
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
  description: z.string().max(255).optional(),
  date: z.coerce.date(),
  // z.coerce.date() accepts multiple formats:
  //   - "2026-01-15" (string) → converts to Date
  //   - Date object → passes through
  // This is useful because JSON doesn't have a Date type — dates
  // arrive as strings from API requests and form submissions.
};

// --- Discriminated union variants ---
// z.discriminatedUnion("type", [...]) tells Zod to look at the
// "type" field first, then apply the matching schema. This gives
// better error messages than z.union() — instead of "invalid input"
// it says exactly which variant failed and why.

const incomeSchema = z.object({
  type: z.literal("INCOME"),
  ...baseTransactionFields,
  fromAccountId: z.string().uuid("Invalid account"),
  categoryId: z.string().uuid("Invalid category"),
});

const expenseSchema = z.object({
  type: z.literal("EXPENSE"),
  ...baseTransactionFields,
  fromAccountId: z.string().uuid("Invalid account"),
  categoryId: z.string().uuid("Invalid category"),
});

const transferSchema = z.object({
  type: z.literal("TRANSFER"),
  ...baseTransactionFields,
  fromAccountId: z.string().uuid("Invalid source account"),
  toAccountId: z.string().uuid("Invalid destination account"),
  toAmount: z
    .number()
    .positive("Transfer amount must be positive")
    .multipleOf(0.01)
    .optional(),
  categoryId: z.string().uuid().optional(),
});

// --- Exported schemas ---

export const createTransactionSchema = z.discriminatedUnion("type", [
  incomeSchema,
  expenseSchema,
  transferSchema,
]);

// For updates, all fields are optional (partial update / PATCH semantics).
// But we still need the type to know which rules apply.
export const updateTransactionSchema = z.discriminatedUnion("type", [
  incomeSchema.partial().extend({ type: z.literal("INCOME") }),
  expenseSchema.partial().extend({ type: z.literal("EXPENSE") }),
  transferSchema.partial().extend({ type: z.literal("TRANSFER") }),
]);

// Query parameters for the GET /api/transactions endpoint.
// All optional — if omitted, returns all transactions.
export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
});

// --- Inferred types ---
// z.infer extracts the TypeScript type from a Zod schema.
// We export these so components and API handlers can use them
// without importing Zod directly.

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
