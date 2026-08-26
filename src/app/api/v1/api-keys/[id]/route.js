// src/app/api/v1/api-keys/[id]/route.js
// Revoke (deactivate) or delete an API key

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/v1/api-keys/[id]
 * Permanently delete an API key.
 */
export const DELETE = withAuth(async (request, context) => {
  const { id } = context.params;

  if (!id) {
    return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
  }

  try {
    const existing = await prisma.wehowareApiKey.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (existing.userId !== request.user.id) {
      return NextResponse.json(
        { error: "Forbidden - You can only manage your own API keys" },
        { status: 403 }
      );
    }

    await prisma.wehowareApiKey.delete({ where: { id } });
  } catch (err) {
    console.error("[api-keys] Delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}, { allowedRoles: ["admin"] });

/**
 * PATCH /api/v1/api-keys/[id]
 * Toggle active/inactive status (revoke without deleting).
 *
 * Body:
 *   { active: boolean }
 */
export const PATCH = withAuth(async (request, context) => {
  const { id } = context.params;

  if (!id) {
    return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { active } = body;
  if (typeof active !== "boolean") {
    return NextResponse.json(
      { error: "active must be a boolean" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.wehowareApiKey.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (existing.userId !== request.user.id) {
      return NextResponse.json(
        { error: "Forbidden - You can only manage your own API keys" },
        { status: 403 }
      );
    }

    const updated = await prisma.wehowareApiKey.update({
      where: { id },
      data: { active },
      select: { id: true, name: true, active: true },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[api-keys] Patch error:", err);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}, { allowedRoles: ["admin"] });
