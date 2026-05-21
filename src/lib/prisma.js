// src/lib/prisma.js
// Prisma client singleton — prevents exhausting DB connections in development
// (Next.js hot-reload creates new module instances; the global guard reuses one)

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
export default prisma;
