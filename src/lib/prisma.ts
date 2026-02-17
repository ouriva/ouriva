// Prisma Client Singleton
// =======================
// In development, Next.js hot-reloads your code on every change.
// Without this singleton, each reload would create a NEW database
// connection pool, eventually exhausting available connections.
//
// This pattern stores the client on `globalThis` (a global object
// that survives hot-reloads) so the same connection is reused.
//
// Prisma 7 uses driver adapters — we use @prisma/adapter-pg with
// the standard Node.js `pg` driver to connect to PostgreSQL.

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
