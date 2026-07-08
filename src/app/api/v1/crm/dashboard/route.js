/**
 * /api/v1/crm/dashboard
 * GET — aggregated CRM dashboard stats for active client
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

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

      const contactWhere = { clientId, active: true };
      const dealWhere = { clientId, active: true };

      const [
        totalContacts,
        totalLeads,
        totalCustomers,
        contactsByStatus,
        contactsBySource,
        totalDeals,
        openDeals,
        wonDeals,
        lostDeals,
        dealsByStage,
        totalPipelineValue,
        totalWonValue,
        totalPipelines,
        totalActivities,
        pendingActivities,
        totalLists,
      ] = await Promise.all([
        prisma.wehowareCrmContact.count({ where: contactWhere }),
        prisma.wehowareCrmContact.count({ where: { ...contactWhere, type: "Lead" } }),
        prisma.wehowareCrmContact.count({ where: { ...contactWhere, type: "Customer" } }),
        prisma.wehowareCrmContact.groupBy({ by: ["status"], where: contactWhere, _count: { _all: true } }),
        prisma.wehowareCrmContact.groupBy({ by: ["source"], where: contactWhere, _count: { _all: true } }),
        prisma.wehowareCrmDeal.count({ where: dealWhere }),
        prisma.wehowareCrmDeal.count({ where: { ...dealWhere, status: "Open" } }),
        prisma.wehowareCrmDeal.count({ where: { ...dealWhere, status: "Won" } }),
        prisma.wehowareCrmDeal.count({ where: { ...dealWhere, status: "Lost" } }),
        prisma.wehowareCrmDeal.groupBy({
          by: ["stageId"],
          where: { ...dealWhere, status: "Open" },
          _count: { _all: true },
          _sum: { value: true },
        }),
        prisma.wehowareCrmDeal.aggregate({ where: { ...dealWhere, status: "Open" }, _sum: { value: true } }),
        prisma.wehowareCrmDeal.aggregate({ where: { ...dealWhere, status: "Won" }, _sum: { value: true } }),
        prisma.wehowareCrmPipeline.count({ where: { clientId, active: true } }),
        prisma.wehowareCrmActivity.count({ where: { clientId } }),
        prisma.wehowareCrmActivity.count({ where: { clientId, completedAt: null } }),
        prisma.wehowareCrmContactList.count({ where: { clientId, active: true } }),
      ]);

      const statusCounts = {};
      for (const s of contactsByStatus) statusCounts[s.status] = s._count._all;

      const sourceCounts = {};
      for (const s of contactsBySource) sourceCounts[s.source] = s._count._all;

      // Enrich deals by stage with stage names
      const stageIds = dealsByStage.map((d) => d.stageId);
      const stages = stageIds.length > 0
        ? await prisma.wehowareCrmPipelineStage.findMany({
            where: { id: { in: stageIds } },
            select: { id: true, name: true, stageType: true, color: true, displayOrder: true },
          })
        : [];
      const stageMap = new Map(stages.map((s) => [s.id, s]));

      const dealsByStageData = dealsByStage.map((d) => ({
        stage_id: d.stageId,
        stage_name: stageMap.get(d.stageId)?.name ?? "Unknown",
        stage_type: stageMap.get(d.stageId)?.stageType ?? "Custom",
        color: stageMap.get(d.stageId)?.color ?? null,
        deal_count: d._count._all,
        total_value: d._sum.value ? Number(d._sum.value) : 0,
      }));

      return NextResponse.json({
        data: {
          contacts: {
            total: totalContacts,
            leads: totalLeads,
            customers: totalCustomers,
            by_status: statusCounts,
            by_source: sourceCounts,
          },
          deals: {
            total: totalDeals,
            open: openDeals,
            won: wonDeals,
            lost: lostDeals,
            pipeline_value: totalPipelineValue._sum.value ? Number(totalPipelineValue._sum.value) : 0,
            won_value: totalWonValue._sum.value ? Number(totalWonValue._sum.value) : 0,
            by_stage: dealsByStageData,
          },
          pipelines: totalPipelines,
          activities: {
            total: totalActivities,
            pending: pendingActivities,
          },
          lists: totalLists,
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/crm/dashboard] error:", err);
      return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
