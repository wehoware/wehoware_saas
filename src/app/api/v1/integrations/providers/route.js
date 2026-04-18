/**
 * /api/v1/integrations/providers
 * GET — list all active integration providers (global, no tenant filter)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function serialize(p) {
  return {
    id: p.id, name: p.name, category: p.category, description: p.description,
    logo_url: p.logoUrl, documentation_url: p.documentationUrl,
    active: p.active, created_at: p.createdAt, updated_at: p.updatedAt,
  };
}

export const GET = withAuth(async (request) => {
  try {
    const { prisma } = request;
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const where = { active: true };
    if (category) where.category = category;

    const providers = await prisma.wehowareIntegrationProvider.findMany({
      where, orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: providers.map(serialize) });
  } catch (err) {
    console.error("[GET /api/v1/integrations/providers]", err);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
