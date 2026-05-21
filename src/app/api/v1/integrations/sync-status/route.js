/**
 * /api/v1/integrations/sync-status
 *
 * GET — returns integration sync health and recent logs for the active client.
 *
 * Response shape:
 * {
 *   integrations: [
 *     { id, name, provider, status, lastSyncAt, errorCount, lastError }
 *   ]
 * }
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) {
      return NextResponse.json({ error: "Active client context required" }, { status: 400 });
    }

    const integrations = await prisma.wehowareIntegration.findMany({
      where: { clientId },
      include: {
        provider: { select: { id: true, name: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch last 10 logs per integration in a single query
    const integrationIds = integrations.map((i) => i.id);
    const recentLogs = await prisma.wehowareIntegrationLog.findMany({
      where: {
        integrationId: { in: integrationIds },
        endTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { endTime: "desc" },
    });

    // Aggregate logs per integration
    const logsByIntegration = new Map();
    for (const log of recentLogs) {
      if (!logsByIntegration.has(log.integrationId)) {
        logsByIntegration.set(log.integrationId, []);
      }
      logsByIntegration.get(log.integrationId).push(log);
    }

    const result = integrations.map((i) => {
      const logs = logsByIntegration.get(i.id) || [];
      const errorCount = logs.filter((l) => l.status === "FAILED" || l.status === "ERROR").length;
      const lastError = logs.find((l) => l.status === "FAILED" || l.status === "ERROR") ?? null;
      return {
        id: i.id,
        name: i.name,
        provider: i.provider?.name ?? i.name,
        category: i.provider?.category ?? "unknown",
        status: i.status,
        lastSyncAt: i.lastSyncAt ?? null,
        errorCount,
        lastError: lastError
          ? {
              operation: lastError.operation,
              status: lastError.status,
              message: lastError.errorMessage,
              time: lastError.endTime,
            }
          : null,
      };
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[GET /api/v1/integrations/sync-status] error:", err);
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
