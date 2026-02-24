// API: GET/PUT /api/settings
// ==========================
// Singleton app settings. The "singleton" row is auto-created on
// first read via upsert. GET also computes the transfer balance
// (net sum of all transactions in the transfer category).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const updateSettingsSchema = z.object({
  transferCategoryId: z.string().uuid().nullable(),
});

export async function GET() {
  try {
    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
      include: { transferCategory: true },
    });

    // Compute transfer balance: net sum of all transactions in the
    // transfer category. Should be 0 if all transfers are matched.
    let transferBalance = 0;
    if (settings.transferCategoryId) {
      const transferTxs = await prisma.transaction.findMany({
        where: { categoryId: settings.transferCategoryId },
        select: { type: true, amount: true },
      });
      for (const tx of transferTxs) {
        const amount = Number(tx.amount);
        transferBalance += tx.type === "INCOME" ? amount : -amount;
      }
    }

    return NextResponse.json({
      data: {
        ...settings,
        transferBalance: Math.round(transferBalance * 100) / 100,
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

    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: { transferCategoryId: parsed.data.transferCategoryId },
      create: {
        id: "singleton",
        transferCategoryId: parsed.data.transferCategoryId,
      },
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
