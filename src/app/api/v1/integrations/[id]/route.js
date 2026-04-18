/**
 * /api/v1/integrations/[id]
 * GET / PUT / DELETE for a single integration
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

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

async function load(prisma, user, id) {
  const clientId = resolveClientId(user);
  if (!clientId) return { status: 400, body: { error: "Active client context required" } };
  const integration = await prisma.wehowareIntegration.findFirst({
    where: { id, clientId },
    include: { provider: { select: { id: true, name: true, logoUrl: true, category: true } } },
  });
  if (!integration) return { status: 404, body: { error: "Integration not found" } };
  return { status: 200, data: integration };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const res = await load(prisma, user, id);
    if (res.status !== 200) return NextResponse.json(res.body, { status: res.status });
    return NextResponse.json({ data: serialize(res.data) });
  } catch (err) {
    console.error("[GET /api/v1/integrations/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch integration" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const auth = await load(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });

    const body = await request.json();
    const data = { updatedBy: user.id };
    if (body.name !== undefined) data.name = body.name;
    if (body.api_key !== undefined || body.apiKey !== undefined) data.apiKey = body.api_key ?? body.apiKey;
    if (body.api_secret !== undefined || body.apiSecret !== undefined) data.apiSecret = body.api_secret ?? body.apiSecret;
    if (body.access_token !== undefined || body.accessToken !== undefined) data.accessToken = body.access_token ?? body.accessToken;
    if (body.config !== undefined) data.config = body.config;
    if (body.status !== undefined) data.status = body.status;
    if (body.sync_frequency !== undefined || body.syncFrequency !== undefined) data.syncFrequency = body.sync_frequency ?? body.syncFrequency;
    if (body.last_sync_at !== undefined || body.lastSyncAt !== undefined) {
      const val = body.last_sync_at ?? body.lastSyncAt;
      data.lastSyncAt = val ? new Date(val) : null;
    }

    if (Object.keys(data).length === 1) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    const updated = await prisma.wehowareIntegration.update({
      where: { id }, data,
      include: { provider: { select: { id: true, name: true, logoUrl: true, category: true } } },
    });
    return NextResponse.json({ data: serialize(updated) });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[PUT /api/v1/integrations/[id]]", err);
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const auth = await load(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });
    await prisma.wehowareIntegration.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v1/integrations/[id]]", err);
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
