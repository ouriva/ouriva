// API: GET/PUT /api/settings
// ==========================
// Singleton app settings. The "singleton" row is auto-created on
// first read via upsert. GET also computes:
//   - transferBalance: net sum of all transactions in the transfer category
//   - nonTrackedBalance: net sum across ALL categories marked excludeFromStats

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const updateSettingsSchema = z.object({
  transferCategoryId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  try {
    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
      include: { transferCategory: true },
    });

    // Helper: compute net balance (income - expense) for a set of category IDs.
    // Returns a positive number when you are owed money (income > expense),
    // negative when you've spent more than you've received back.
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

    // Fetch all non-tracked categories to compute their combined balance
    const nonTrackedCategories = await prisma.category.findMany({
      where: { excludeFromStats: true },
      select: { id: true },
    });
    const nonTrackedIds = nonTrackedCategories.map((c) => c.id);

    const [transferBalance, nonTrackedBalance] = await Promise.all([
      settings.transferCategoryId
        ? computeBalance([settings.transferCategoryId])
        : Promise.resolve(0),
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid settings data",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | null> = {};
    if (parsed.data.transferCategoryId !== undefined) {
      updateData.transferCategoryId = parsed.data.transferCategoryId;
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: updateData,
      create: { id: "singleton", ...updateData },
      include: { transferCategory: true },
    });

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
