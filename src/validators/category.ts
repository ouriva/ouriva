// Category Validation Schemas
// ===========================

import { z } from "zod/v4";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  parentId: z.string().uuid().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
  excludeFromStats: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
