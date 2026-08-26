// src/app/api/v1/api-keys/route.js
// API key management — create, list, revoke
// Admin-only: API keys inherit the creator's role and permissions

import { NextResponse } from "next/server";
import crypto from "crypto";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/api-keys
 * Create a new API key. The raw key is returned ONLY in this response —
 * it cannot be retrieved later (only the hash is stored).
 *
 * Body:
 *   { name: string, expiresAt?: string (ISO date) }
 *
 * Response:
 *   { id, name, key: "whk_...", keyPrefix, expiresAt, createdAt }
 */
export const POST = withAuth(async (request) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, expiresAt } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  // Generate a random API key: whk_ + 32 hex chars
  const randomBytes = crypto.randomBytes(16).toString("hex");
  const rawKey = `whk_${randomBytes}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = `whk_${randomBytes.slice(0, 8)}`;

  let apiKey;
  try {
    apiKey = await prisma.wehowareApiKey.create({
      data: {
        userId: request.user.id,
        name: name.trim().slice(0, 255),
        keyHash,
        keyPrefix,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
  } catch (err) {
    console.error("[api-keys] Create error:", err);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey, // ONLY returned here — never again
      keyPrefix: apiKey.keyPrefix,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      message: "Save this key securely — it cannot be retrieved later.",
    },
    { status: 201 }
  );
}, { allowedRoles: ["admin"] });

/**
 * GET /api/v1/api-keys
 * List all API keys for the current user (without the raw key).
 *
 * Response:
 *   { data: [{ id, name, keyPrefix, active, lastUsedAt, expiresAt, createdAt }] }
 */
export const GET = withAuth(async (request) => {
  let keys;
  try {
    keys = await prisma.wehowareApiKey.findMany({
      where: { userId: request.user.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        active: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("[api-keys] List error:", err);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: keys });
}, { allowedRoles: ["admin"] });
