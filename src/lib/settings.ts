// App Settings Helper
// ===================
// Reads the singleton AppSettings row. Used by summary and budget
// APIs to exclude the user-configured transfer category.

import { prisma } from "@/lib/prisma";

export async function getTransferCategoryId(): Promise<string | null> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  return settings?.transferCategoryId ?? null;
}

export async function getExcludedCategoryIds(): Promise<string[]> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  return [settings?.transferCategoryId, settings?.proxyCategoryId].filter(
    (id): id is string => !!id
  );
}
