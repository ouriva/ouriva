// API: GET/PUT /api/settings
// ==========================
// Singleton app settings. The "singleton" row is auto-created on
// first read via upsert. GET also computes the transfer balance
// (net sum of all transactions in the transfer category).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const updateSettingsSchema = z.object({
  transferCategoryId: z.string().uuid().nullable().optional(),
  proxyCategoryId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  try {
    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
      include: { transferCategory: true, proxyCategory: true },
    });

    // Helper: compute net balance (income - expense) for a category.
    // Should be 0 when all transactions in that category are settled.
    async function computeBalance(categoryId: string): Promise<number> {
      const txs = await prisma.transaction.findMany({
        where: { categoryId },
        select: { type: true, amount: true },
      });
      let balance = 0;
      for (const tx of txs) {
        const amount = Number(tx.amount);
        balance += tx.type === "INCOME" ? amount : -amount;
      }
      return Math.round(balance * 100) / 100;
    }

    const [transferBalance, proxyBalance] = await Promise.all([
      settings.transferCategoryId
        ? computeBalance(settings.transferCategoryId)
        : Promise.resolve(0),
      settings.proxyCategoryId
        ? computeBalance(settings.proxyCategoryId)
        : Promise.resolve(0),
    ]);

    return NextResponse.json({
      data: {
        ...settings,
        transferBalance,
        proxyBalance,
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
    if (parsed.data.proxyCategoryId !== undefined) {
      updateData.proxyCategoryId = parsed.data.proxyCategoryId;
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: updateData,
      create: { id: "singleton", ...updateData },
      include: { transferCategory: true, proxyCategory: true },
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
