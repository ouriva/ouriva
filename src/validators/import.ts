// Import Validation Schemas
// =========================
// Zod schemas for the bank statement import feature.
// These validate data flowing through the 4-step import wizard:
//   1. File parsing (upload + parse)
//   2. Column mapping (user maps file columns to transaction fields)
//   3. Duplicate checking (compare importRefs against existing data)
//   4. Execution (bulk create transactions)
//
// Also includes schemas for ImportProfile CRUD — saved column mappings
// that users can reuse across imports from the same bank.

import { z } from "zod/v4";
import { categoryIdSchema } from "./transaction";

// --- Column Mapping ---
// Maps file column indices to transaction fields.
//
// Amount can be mapped two ways:
//   1. Single column: `amount` — positive values = income, negative = expense
//   2. Split columns: `debitAmount` + `creditAmount` — common in European banks
//      that have separate "Débito" and "Crédito" columns
//
// `reference` is optional — when provided, the bank's own transaction ID
// is used for deduplication instead of a content-based hash.

const columnIndex = z.number().int().min(0);

export const columnMapSchema = z.object({
  date: columnIndex,
  description: columnIndex,
  amount: columnIndex.optional(),
  debitAmount: columnIndex.optional(),
  creditAmount: columnIndex.optional(),
  reference: columnIndex.optional(),
  exchangeRate: columnIndex.optional(),
});

export type ColumnMap = z.infer<typeof columnMapSchema>;

// --- Check Duplicates ---
// Accepts an array of importRef strings and returns which ones already
// exist in the database. Used in Step 3 to badge duplicate rows.

export const checkDuplicatesSchema = z.object({
  importRefs: z.array(z.string()).min(1).max(10000),
});

export type CheckDuplicatesInput = z.infer<typeof checkDuplicatesSchema>;

// --- Execute Import ---
// Each item represents a single transaction to create from the import.
// The client sends the fully-mapped, user-approved list from Step 4.

export const importTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.number().positive(),
  description: z.string().optional(),
  friendlyName: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  date: z.string(), // ISO date string, parsed server-side
  fromAccountId: z.uuid(),
  categoryId: categoryIdSchema.optional(),
  importRef: z.string(),
  needsReview: z.boolean().optional(),
  exchangeRate: z.number().positive().optional(),
});

export const executeImportSchema = z.object({
  transactions: z.array(importTransactionSchema).min(1).max(10000),
});

export type ImportTransaction = z.infer<typeof importTransactionSchema>;
export type ExecuteImportInput = z.infer<typeof executeImportSchema>;

// --- Import Profile CRUD ---
// Profiles store column mappings so users don't re-map every time.

export const createImportProfileSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).max(100),
  fileType: z.enum(["csv", "xlsx"]),
  columnMap: columnMapSchema,
  dateFormat: z.string().default("yyyy-MM-dd"),
  delimiter: z.string().max(5).nullable().default(null),
  skipRows: z.number().int().min(0).default(0),
});

export const updateImportProfileSchema = createImportProfileSchema.partial();

export type CreateImportProfileInput = z.infer<typeof createImportProfileSchema>;
export type UpdateImportProfileInput = z.infer<typeof updateImportProfileSchema>;
