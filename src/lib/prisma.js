// src/lib/prisma.js
// Prisma client singleton — prevents exhausting DB connections in development
// (Next.js hot-reload creates new module instances; the global guard reuses one)

// AWS Amplify workaround: Lambda runtime doesn't inject server-side env vars.
// Load from .env.production (written during amplify.yml build step) as fallback.
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".next/.env.production", quiet: true });
dotenvConfig({ path: ".env.production", quiet: true });

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
