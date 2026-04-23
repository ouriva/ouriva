import { z } from "zod/v4";

export const createCategoryRuleSchema = z.object({
  pattern:      z.string().min(1).max(255),
  matchType:    z.enum(["CONTAINS", "STARTS_WITH", "EXACT", "REGEX"]).default("CONTAINS"),
  priority:     z.number().int().min(0).default(0),
  isActive:     z.boolean().default(true),
  categoryId:   z.uuid(),
  friendlyName: z.string().max(255).nullable().optional(),
});

export const updateCategoryRuleSchema = createCategoryRuleSchema.partial();
