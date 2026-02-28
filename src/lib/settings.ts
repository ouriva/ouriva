// App Settings Helper
// ===================
// Reads the singleton AppSettings row and category-level flags.
// Used by summary and budget APIs to exclude configured categories.

import { prisma } from "@/lib/prisma";

export async function getTransferCategoryId(): Promise<string | null> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  return settings?.transferCategoryId ?? null;
}

export async function getExcludedCategoryIds(): Promise<string[]> {
  // Run both queries in parallel — AppSettings for the transfer category,
  // Category table for all non-tracked (excludeFromStats) categories.
  const [settings, nonTrackedCategories] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    prisma.category.findMany({
      where: { excludeFromStats: true },
      select: { id: true },
    }),
  ]);

  return [
    settings?.transferCategoryId,
    ...nonTrackedCategories.map((c) => c.id),
  ].filter((id): id is string => !!id);
}
