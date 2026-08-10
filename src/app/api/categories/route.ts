// API: GET/POST /api/categories
// ==============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { createCategorySchema } from "@/validators/category";
import type { CategoryType } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const showAll  = request.nextUrl.searchParams.get("all") === "true";
    const typeParam = request.nextUrl.searchParams.get("type");
    const typeFilter = typeParam === "INCOME" || typeParam === "EXPENSE" || typeParam === "TRANSFER" ? typeParam : undefined;

    const categories = await prisma.category.findMany({
      where: {
        ...(showAll ? {} : { isActive: true }),
        ...(typeFilter ? { type: typeFilter } : {}),
      },
      include: {
        parent: true,
        children: {
          where: {
            ...(showAll ? {} : { isActive: true }),
            ...(typeFilter ? { type: typeFilter } : {}),
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);

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

    // Enforce max 2 levels: if parentId is set, the parent must not have a parent.
    // Subcategories inherit the parent's CategoryType so the tree stays consistent.
    let resolvedType: CategoryType = parsed.data.type;
    if (parsed.data.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parsed.data.parentId },
      });
      if (parent?.parentId) {
        return NextResponse.json(
          {
            error: {
              message: "Cannot create subcategory of a subcategory. Maximum depth is 2 levels.",
              code: "VALIDATION_ERROR",
            },
          },
          { status: 400 }
        );
      }
      if (parent) resolvedType = parent.type;
    }

    const category = await prisma.category.create({
      data: { ...parsed.data, type: resolvedType },
      include: { parent: true, children: true },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("POST /api/categories error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
