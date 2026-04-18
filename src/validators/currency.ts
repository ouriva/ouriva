// Currency Validation Schemas
// ===========================

import { z } from "zod/v4";

export const createCurrencySchema = z.object({
  code: z
    .string()
    .min(3, { message: "Currency code must be 3 characters" })
    .max(3, { message: "Currency code must be 3 characters" })
    .toUpperCase(),
  name: z.string().min(1, { message: "Name is required" }).max(100),
  symbol: z.string().min(1, { message: "Symbol is required" }).max(5),
});

export const updateCurrencySchema = createCurrencySchema.partial();

export type CreateCurrencyInput = z.infer<typeof createCurrencySchema>;
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;
