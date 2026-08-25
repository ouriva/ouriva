// API: GET/PATCH /api/settings
// =============================
// Singleton app settings. The "singleton" row is auto-created on
// first read via upsert. GET also computes:
//   - transferBalance: net of Transfer In minus Transfer Out (0 = balanced)
//   - nonTrackedBalance: net sum across ALL categories marked excludeFromStats
//
// PATCH applies a partial update — used by the General Settings page to
// flip the 50·30·20 visibility toggles (budgetSplitEnabled/InSummary/InBudget).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { updateSettingsSchema } from "@/validators/settings";

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

    // Transfer balance: net of Transfer In minus Transfer Out.
    // Zero means all transfers are balanced (every outgoing has a matching
    // incoming). Non-zero signals a missing side. All amounts are positive;
    // direction comes from the category name.
    async function computeTransferBalance(): Promise<number> {
      const txs = await prisma.transaction.findMany({
        where: { type: "TRANSFER" },
        select: { amount: true, category: { select: { name: true } } },
      });
      let net = 0;
      for (const tx of txs) {
        const amount = Number(tx.amount);
        if (tx.category?.name === "Transfer In") net += amount;
        else if (tx.category?.name === "Transfer Out") net -= amount;
      }
      return Math.round(net * 100) / 100;
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = updateSettingsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details: z.treeifyError(result.error),
          },
        },
        { status: 400 }
      );
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: result.data,
      create: { id: "singleton", ...result.data },
    });

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("PATCH /api/settings error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
