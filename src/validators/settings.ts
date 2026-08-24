// Settings Validators
// ===================
// Zod schema for updating the singleton AppSettings row. All fields are
// optional — the PATCH endpoint applies a partial update.

import { z } from "zod/v4";

export const updateSettingsSchema = z.object({
  budgetSplitEnabled: z.boolean().optional(),
  budgetSplitInSummary: z.boolean().optional(),
  budgetSplitInBudget: z.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
