/**
 * POST /api/v1/daily-reports/[id]/submit
 *
 * Submit a daily work report (only the creator can submit, or admin/owner on behalf).
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
      if (!mutationCheck.canSubmit) {
        return NextResponse.json(
          { error: mutationCheck.reason || "You cannot submit this report" },
          { status: 403 }
        );
      }

      if (existing.status !== "draft") {
        return NextResponse.json({ error: "Report is already submitted" }, { status: 409 });
      }

      const updated = await prisma.wehowareDailyWorkReport.update({
        where: { id },
        data: {
          status: "submitted",
          submittedBy: user.id,
          submittedAt: new Date(),
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
      console.error("[POST /api/v1/daily-reports/[id]/submit] error:", err);
      return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
