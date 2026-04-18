/**
 * /api/v1/integrations/[id]/logs
 * GET — list integration logs (paginated, newest first)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(l) {
  return {
    id: l.id, client_id: l.clientId, integration_id: l.integrationId,
    operation: l.operation, status: l.status, details: l.details,
    start_time: l.startTime, end_time: l.endTime,
    records_processed: l.recordsProcessed, error_message: l.errorMessage,
  };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: integrationId } = await params;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    // Verify integration belongs to this client
    const integration = await prisma.wehowareIntegration.findFirst({
      where: { id: integrationId, clientId }, select: { id: true },
    });
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)));

    const [items, total] = await Promise.all([
      prisma.wehowareIntegrationLog.findMany({
        where: { integrationId },
        orderBy: { startTime: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareIntegrationLog.count({ where: { integrationId } }),
    ]);

    return NextResponse.json({
      data: items.map(serialize),
      pagination: { page, limit, totalItems: total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error("[GET /api/v1/integrations/[id]/logs]", err);
    return NextResponse.json({ error: "Failed to fetch integration logs" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
