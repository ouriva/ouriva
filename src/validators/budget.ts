// Budget Validators
// =================
// Zod schemas for budget CRUD operations.
//
// Budget uses an "upsert" pattern — when the user sets a budget for a
// category+year, we either create a new record or update the existing one.
// The unique constraint [year, categoryId] ensures one budget per category
// per year. Which tab (income/expense) a category appears in is determined
// by Category.type, not by the budget entry itself.

import { z } from "zod/v4";

// For creating/updating a single budget entry
export const upsertBudgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  categoryId: z.uuid(),
  amount: z.number().min(0),
  note: z.string().max(500).nullable().optional(),
});

// For bulk-upserting multiple budget entries at once.
export const bulkUpsertBudgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  budgets: z.array(
    z.object({
      categoryId: z.uuid(),
      amount: z.number().min(0),
      note: z.string().max(500).nullable().optional(),
    })
  ),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
export type BulkUpsertBudgetInput = z.infer<typeof bulkUpsertBudgetSchema>;
