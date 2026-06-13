/**
 * GET /api/public/blogs/categories
 *
 * List blog categories that have at least one published post for a client.
 *
 * Usage:
 *   GET /api/public/blogs/categories?domain=example.com
 *   GET /api/public/blogs/categories?clientId=uuid-here
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

    // Only return categories that have at least one published blog in this client
    const categories = await prisma.wehowareBlogCategory.findMany({
      where: {
        clientId: client.id,
        blogs: {
          some: { status: "Published" },
        },
      },
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("[GET /api/public/blogs/categories] error:", err);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
