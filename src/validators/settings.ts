// Settings Validators
// ===================
// Zod schema for updating the singleton AppSettings row. Boolean fields are
// independent and may be patched one at a time. The three target fields are
// interdependent (they represent a 100%-of-income split) — if any one is
// present, all three must be present and must sum to exactly 100.

import { z } from "zod/v4";

export const updateSettingsSchema = z
  .object({
    budgetSplitEnabled: z.boolean().optional(),
    budgetSplitInSummary: z.boolean().optional(),
    budgetSplitInBudget: z.boolean().optional(),
    needsTarget: z.number().int().min(1).max(98).optional(),
    wantsTarget: z.number().int().min(1).max(98).optional(),
    savingsTarget: z.number().int().min(1).max(98).optional(),
  })
  .superRefine((data, ctx) => {
    const targets = [data.needsTarget, data.wantsTarget, data.savingsTarget];
    const anyTargetSet = targets.some((v) => v !== undefined);
    if (!anyTargetSet) return;

    if (targets.some((v) => v === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["needsTarget"],
        message: "needsTarget, wantsTarget, and savingsTarget must all be provided together",
      });
      return;
    }

    const sum = data.needsTarget! + data.wantsTarget! + data.savingsTarget!;
    if (sum !== 100) {
      ctx.addIssue({
        code: "custom",
        path: ["needsTarget"],
        message: `needsTarget + wantsTarget + savingsTarget must sum to 100 (got ${sum})`,
      });
    }
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
