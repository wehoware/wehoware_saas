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
import { resolveClient, buildItemListSchema } from "@/lib/public-seo";

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

    return NextResponse.json({
      categories,
      schema: {
        item_list: buildItemListSchema(
          categories.map((c) => ({ slug: c.slug, title: c.name, canonical_url: null })),
          client.domain ? `https://${client.domain}/services/categories` : "/api/public/services/categories"
        ),
      },
    });
  } catch (err) {
    console.error("[GET /api/public/services/categories] error:", err);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
