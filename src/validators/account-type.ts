// Account Type Validation Schemas
// ================================

import { z } from "zod/v4";

export const createAccountTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export const updateAccountTypeSchema = createAccountTypeSchema.partial();

export type CreateAccountTypeInput = z.infer<typeof createAccountTypeSchema>;
export type UpdateAccountTypeInput = z.infer<typeof updateAccountTypeSchema>;
