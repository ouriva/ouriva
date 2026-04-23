// API: GET/PUT/DELETE /api/import/profiles/[id]
// ==============================================
// Single import profile operations.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { updateImportProfileSchema } from "@/validators/import";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await prisma.importProfile.findUnique({ where: { id } });

    if (!profile) {
      return NextResponse.json(
        { error: { message: "Profile not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error("GET /api/import/profiles/[id] error:", error);
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
    const body = await request.json();
    const parsed = updateImportProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details: z.treeifyError(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const existing = await prisma.importProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Profile not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const profile = await prisma.importProfile.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error("PUT /api/import/profiles/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.importProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Profile not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    await prisma.importProfile.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/import/profiles/[id] error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
