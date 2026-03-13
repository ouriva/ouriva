// Default Currency Helper
// =======================
// Returns the app's default currency. Falls back to the first created
// currency if none has isDefault = true (handles fresh installs where
// the flag hasn't been set yet).

import { prisma } from "@/lib/prisma";

export type DefaultCurrency = {
  id: string;
  code: string;
  symbol: string;
  name: string;
};

export async function getDefaultCurrency(): Promise<DefaultCurrency | null> {
  // Try the explicitly flagged default first
  const flagged = await prisma.currency.findFirst({
    where: { isDefault: true },
    select: { id: true, code: true, symbol: true, name: true },
  });
  if (flagged) return flagged;

  // Fall back to oldest currency (first one ever created)
  return prisma.currency.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, symbol: true, name: true },
  });
}
