// Account Validation Schemas
// ==========================

import { z } from "zod/v4";

export const createAccountSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).max(100),
  initialBalance: z.number().default(0),
  currencyId: z.uuid("Invalid currency"),
  accountTypeId: z.uuid("Invalid account type"),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
