// Category Validation Schemas
// ===========================

import { z } from "zod/v4";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  parentId: z.uuid().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
  excludeFromStats: z.boolean().optional(),
  bucket: z.enum(["NEEDS", "WANTS", "SAVINGS"]).nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
