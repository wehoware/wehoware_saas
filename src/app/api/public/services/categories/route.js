/**
 * GET /api/public/services/categories
 *
 * List active service categories for a client.
 *
 * Usage:
 *   GET /api/public/services/categories?domain=example.com
 *   GET /api/public/services/categories?clientId=uuid-here
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function resolveClient(domain, clientId) {
  if (!domain && !clientId) return null;
  const where = {};
  if (domain) where.domain = domain;
  if (clientId) where.id = clientId;
  const client = await prisma.wehowareClient.findFirst({
    where,
    select: { id: true, active: true },
  });
  if (!client) return null;
  if (!client.active) return { inactive: true, id: client.id };
  return client;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain")?.trim();
    const clientId = url.searchParams.get("clientId")?.trim();

    const client = await resolveClient(domain, clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (client.inactive) {
      return NextResponse.json({ error: "Client is inactive" }, { status: 403 });
    }

    const categories = await prisma.wehowareServiceCategory.findMany({
      where: { clientId: client.id, active: true },
      select: { id: true, name: true, slug: true, description: true, iconUrl: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("[GET /api/public/services/categories] error:", err);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
