// API: GET /api/settings
// ======================
// Singleton app settings. The "singleton" row is auto-created on
// first read via upsert. GET also computes:
//   - transferBalance: total volume of all TRANSFER-type transactions
//   - nonTrackedBalance: net sum across ALL categories marked excludeFromStats

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    // Helper: compute net balance (income - expense) for a set of category IDs.
    async function computeBalance(categoryIds: string[]): Promise<number> {
      if (categoryIds.length === 0) return 0;
      const txs = await prisma.transaction.findMany({
        where: { categoryId: { in: categoryIds } },
        select: { type: true, amount: true },
      });
      let balance = 0;
      for (const tx of txs) {
        const amount = Number(tx.amount);
        balance += tx.type === "INCOME" ? amount : -amount;
      }
      return Math.round(balance * 100) / 100;
    }

    // Transfer balance: total volume of all TRANSFER transactions.
    // All TRANSFER amounts are positive (direction is in the category),
    // so summing them gives total money moved between accounts.
    async function computeTransferBalance(): Promise<number> {
      const result = await prisma.transaction.aggregate({
        where: { type: "TRANSFER" },
        _sum: { amount: true },
      });
      return Math.round(Number(result._sum.amount ?? 0) * 100) / 100;
    }

    const nonTrackedCategories = await prisma.category.findMany({
      where: { excludeFromStats: true },
      select: { id: true },
    });
    const nonTrackedIds = nonTrackedCategories.map((c) => c.id);

    const [transferBalance, nonTrackedBalance] = await Promise.all([
      computeTransferBalance(),
      computeBalance(nonTrackedIds),
    ]);

    return NextResponse.json({
      data: {
        ...settings,
        transferBalance,
        nonTrackedBalance,
      },
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
