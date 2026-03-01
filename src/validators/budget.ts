// Budget Validators
// =================
// Zod schemas for budget CRUD operations.
//
// Budget uses an "upsert" pattern — when the user sets a budget
// for a category+year, we either create a new record or update
// the existing one. The unique constraint [year, categoryId, type]
// ensures one budget per category per year per type (EXPENSE or INCOME).

import { z } from "zod/v4";

// For creating/updating a single budget entry
export const upsertBudgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  categoryId: z.string().uuid(),
  amount: z.number().min(0),
  type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
});

// For bulk-upserting multiple budget entries at once.
// Each entry carries its own type so expense and income budgets
// can be saved in a single request.
export const bulkUpsertBudgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  budgets: z.array(
    z.object({
      categoryId: z.string().uuid(),
      amount: z.number().min(0),
      type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
    })
  ),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
export type BulkUpsertBudgetInput = z.infer<typeof bulkUpsertBudgetSchema>;
