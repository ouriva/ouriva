// API: GET/PUT/DELETE /api/categories/[id]
// ========================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { updateCategorySchema } from "@/validators/category";

// System categories are seeded by migration and must not be modified or
// deleted — direction logic (balances, day-net, transfer balance) relies
// on the exact names "Transfer In" and "Transfer Out".
const SYSTEM_CATEGORY_IDS = new Set([
  "00000000-0000-0000-0000-000000000001", // Transfer (parent)
  "00000000-0000-0000-0000-000000000002", // Transfer In
  "00000000-0000-0000-0000-000000000003", // Transfer Out
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: { message: "Category not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("GET /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (SYSTEM_CATEGORY_IDS.has(id)) {
      return NextResponse.json(
        { error: { message: "System categories cannot be modified", code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid category data",
            code: "VALIDATION_ERROR",
            details: z.flattenError(parsed.error).fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { parent: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Category not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    // Children always inherit their parent's type — ignore any type sent in the body.
    const isParent = existing.parentId === null;
    const effectiveData = !isParent && existing.parent
      ? { ...parsed.data, type: existing.parent.type }
      : parsed.data;

    const typeChanged = effectiveData.type && effectiveData.type !== existing.type;

    const [category] = await prisma.$transaction([
      prisma.category.update({
        where: { id },
        data: effectiveData,
        include: { parent: true, children: true },
      }),
      ...(typeChanged && isParent
        ? [
            prisma.category.updateMany({
              where: { parentId: id },
              data: { type: effectiveData.type },
            }),
          ]
        : []),
    ]);

    return NextResponse.json(category);
  } catch (error) {
    console.error("PUT /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

// Hard delete: removes the category and, for a parent, all of its children.
// Blocked entirely if any transaction references the category or any child
// (splits are themselves Transaction rows with their own categoryId, so a
// single count over targetIds covers both top-level transactions and splits).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (SYSTEM_CATEGORY_IDS.has(id)) {
      return NextResponse.json(
        { error: { message: "System categories cannot be deleted", code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { message: "Category not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const targetIds = [id, ...existing.children.map((c) => c.id)];

    const transactionCount = await prisma.transaction.count({
      where: { categoryId: { in: targetIds } },
    });

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          error: {
            message: `Cannot delete category — ${transactionCount} transaction(s) still reference it.`,
            code: "CONSTRAINT_ERROR",
          },
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.categoryRule.deleteMany({ where: { categoryId: { in: targetIds } } }),
      prisma.budget.deleteMany({ where: { categoryId: { in: targetIds } } }),
      prisma.category.deleteMany({ where: { id: { in: targetIds } } }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
