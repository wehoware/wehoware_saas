/**
 * /api/v1/crm/contacts/stats
 * GET — aggregated contact stats for dashboard
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }

      const where = { clientId, active: true };

      const [
        totalContacts,
        totalLeads,
        totalCustomers,
        byStatus,
        bySource,
      ] = await Promise.all([
        prisma.wehowareCrmContact.count({ where }),
        prisma.wehowareCrmContact.count({ where: { ...where, type: "Lead" } }),
        prisma.wehowareCrmContact.count({ where: { ...where, type: "Customer" } }),
        prisma.wehowareCrmContact.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),
        prisma.wehowareCrmContact.groupBy({
          by: ["source"],
          where,
          _count: { _all: true },
        }),
      ]);

      const statusCounts = {};
      for (const s of byStatus) statusCounts[s.status] = s._count._all;

      const sourceCounts = {};
      for (const s of bySource) sourceCounts[s.source] = s._count._all;

      return NextResponse.json({
        data: {
          total_contacts: totalContacts,
          total_leads: totalLeads,
          total_customers: totalCustomers,
          by_status: statusCounts,
          by_source: sourceCounts,
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/crm/contacts/stats] error:", err);
      return NextResponse.json({ error: "Failed to fetch contact stats" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
