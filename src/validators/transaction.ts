// Transaction Validation Schemas
// ==============================
// Zod schemas define the "shape" of valid data. They serve two purposes:
//   1. Runtime validation — catch bad data from API requests
//   2. Type inference — generate TypeScript types automatically
//
// We use a DISCRIMINATED UNION for transaction types:
//   - INCOME requires: fromAccountId, categoryId
//   - EXPENSE requires: fromAccountId, categoryId

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
  friendlyName: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  date: z.coerce.date(),
};

// --- Discriminated union variants ---

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
});

// --- Inferred types ---

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
