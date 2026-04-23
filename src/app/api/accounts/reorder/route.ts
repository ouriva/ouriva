// API: PATCH /api/accounts/reorder
// =================================
// Accepts an ordered array of { id, sortOrder } pairs and persists
// them in a single transaction. The client sends the full desired
// order so the server never has to infer it.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const reorderSchema = z.array(
  z.object({
    id: z.uuid(),
    sortOrder: z.number().int().min(0),
  })
);

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid reorder data",
            code: "VALIDATION_ERROR",
            details: z.flattenError(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    // Run all updates in a transaction so the order is never partially applied
    await prisma.$transaction(
      parsed.data.map(({ id, sortOrder }) =>
        prisma.account.update({ where: { id }, data: { sortOrder } })
      )
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("PATCH /api/accounts/reorder error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
