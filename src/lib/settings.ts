// App Settings Helper
// ===================
// Reads category-level flags used by summary and budget APIs.

import { prisma } from "@/lib/prisma";

export async function getExcludedCategoryIds(): Promise<string[]> {
  const nonTrackedCategories = await prisma.category.findMany({
    where: { excludeFromStats: true },
    select: { id: true },
  });
  return nonTrackedCategories.map((c) => c.id);
}
