// API: GET /api/health
// ====================
// Liveness + readiness probe for Docker's HEALTHCHECK and deploy scripts.
// A page like "/" renders even when PostgreSQL is down, so a probe on it
// reports "healthy" while every API call fails. This route runs the
// cheapest possible query, SELECT 1, so it only answers 200 when the app
// can actually reach its database.
//
// The query is raced against a timeout: if the database hangs (rather
// than refusing the connection), the probe fails fast with 503 instead of
// hanging until Docker's own timeout kills it.
//
// The response never includes error details: the route is public, and a
// connection error can contain the database host or user. Details go to
// the server log only.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DB_TIMEOUT_MS = 5000;

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("database timeout")), DB_TIMEOUT_MS);
      }),
    ]);
    return NextResponse.json(
      { data: { status: "ok" } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/health error:", error);
    return NextResponse.json(
      { error: { message: "Database unavailable", code: "DATABASE_UNAVAILABLE" } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    clearTimeout(timer);
  }
}
