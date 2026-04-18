/**
 * /api/v1/integrations
 * GET  — list integrations for caller's client
 * POST — create an integration
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(i) {
  return {
    id: i.id, client_id: i.clientId, provider_id: i.providerId,
    name: i.name, api_key: i.apiKey, api_secret: i.apiSecret,
    config: i.config, status: i.status,
    last_sync_at: i.lastSyncAt, sync_frequency: i.syncFrequency,
    created_at: i.createdAt, updated_at: i.updatedAt,
    created_by: i.createdBy, updated_by: i.updatedBy,
    provider: i.provider ? {
      id: i.provider.id, name: i.provider.name,
      logo_url: i.provider.logoUrl, category: i.provider.category,
    } : null,
  };
}

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const integrations = await prisma.wehowareIntegration.findMany({
      where: { clientId },
      include: { provider: { select: { id: true, name: true, logoUrl: true, category: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: integrations.map(serialize) });
  } catch (err) {
    console.error("[GET /api/v1/integrations]", err);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const POST = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const body = await request.json();
    const providerId = body?.provider_id ?? body?.providerId;
    if (!body?.name || !providerId) return NextResponse.json({ error: "name and provider_id are required" }, { status: 400 });

    const integration = await prisma.wehowareIntegration.create({
      data: {
        clientId,
        providerId,
        name: body.name,
        apiKey: body.api_key ?? body.apiKey ?? null,
        apiSecret: body.api_secret ?? body.apiSecret ?? null,
        accessToken: body.access_token ?? body.accessToken ?? null,
        refreshToken: body.refresh_token ?? body.refreshToken ?? null,
        config: body.config ?? {},
        status: body.status ?? "Active",
        syncFrequency: body.sync_frequency ?? body.syncFrequency ?? null,
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: { provider: { select: { id: true, name: true, logoUrl: true, category: true } } },
    });
    return NextResponse.json({ data: serialize(integration) }, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    if (err?.code === "P2003") return NextResponse.json({ error: "Invalid provider_id" }, { status: 400 });
    console.error("[POST /api/v1/integrations]", err);
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
