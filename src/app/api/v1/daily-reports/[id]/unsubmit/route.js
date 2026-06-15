/**
 * POST /api/v1/daily-reports/[id]/unsubmit
 *
 * Unsubmit a daily work report (admin/owner/manager only).
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";
import { loadReport, canMutateReport, shapeReport } from "../../../../utils/daily-report-access";

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const existing = await loadReport(prisma, user, id);
      if (!existing) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      const mutationCheck = canMutateReport(user, existing);
      if (!mutationCheck.canUnsubmit) {
        return NextResponse.json(
          { error: mutationCheck.reason || "You cannot unsubmit this report" },
          { status: 403 }
        );
      }

      if (existing.status !== "submitted") {
        return NextResponse.json({ error: "Report is not submitted" }, { status: 409 });
      }

      const updated = await prisma.wehowareDailyWorkReport.update({
        where: { id },
        data: {
          status: "draft",
          submittedBy: null,
          submittedAt: null,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          items: { orderBy: { sequence: "asc" } },
        },
      });

      const out = shapeReport(updated);
      out._permissions = canMutateReport(user, updated);
      return NextResponse.json(out);
    } catch (err) {
      console.error("[POST /api/v1/daily-reports/[id]/unsubmit] error:", err);
      return NextResponse.json({ error: "Failed to unsubmit report" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
