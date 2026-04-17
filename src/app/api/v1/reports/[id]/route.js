/**
 * /api/v1/reports/[id]
 * Prisma/MySQL-backed handlers for a single report.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeReport(r) {
  return {
    id: r.id,
    client_id: r.clientId,
    template_id: r.templateId,
    title: r.title,
    description: r.description,
    report_data: r.reportData,
    date_range_start: r.dateRangeStart,
    date_range_end: r.dateRangeEnd,
    status: r.status,
    is_scheduled: r.isScheduled,
    schedule_frequency: r.scheduleFrequency,
    last_generated_at: r.lastGeneratedAt,
    next_generation_at: r.nextGenerationAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    created_by: r.createdBy,
    updated_by: r.updatedBy,
    creator: r.creator
      ? {
          id: r.creator.id,
          first_name: r.creator.firstName,
          last_name: r.creator.lastName,
        }
      : null,
    updater: r.updater
      ? {
          id: r.updater.id,
          first_name: r.updater.firstName,
          last_name: r.updater.lastName,
        }
      : null,
  };
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const report = await prisma.wehowareReport.findFirst({
        where: { id, clientId },
        include: {
          creator: { select: { id: true, firstName: true, lastName: true } },
          updater: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!report) {
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(serializeReport(report));
    } catch (err) {
      console.error("[GET /api/v1/reports/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareReport.findFirst({
        where: { id, clientId: user.activeClientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 }
        );
      }

      const body = await request.json();
      const data = { updatedBy: user.id };
      if (body.title !== undefined) data.title = body.title;
      if (body.description !== undefined) data.description = body.description;
      if (body.report_data !== undefined) data.reportData = body.report_data;
      if (body.reportData !== undefined) data.reportData = body.reportData;
      if (body.status !== undefined) data.status = body.status;
      if (body.template_id !== undefined) data.templateId = body.template_id;
      if (body.templateId !== undefined) data.templateId = body.templateId;
      if (body.date_range_start !== undefined) {
        data.dateRangeStart = body.date_range_start
          ? new Date(body.date_range_start)
          : null;
      }
      if (body.date_range_end !== undefined) {
        data.dateRangeEnd = body.date_range_end
          ? new Date(body.date_range_end)
          : null;
      }
      if (body.is_scheduled !== undefined) data.isScheduled = body.is_scheduled;
      if (body.schedule_frequency !== undefined) {
        data.scheduleFrequency = body.schedule_frequency;
      }

      if (Object.keys(data).length === 1) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const report = await prisma.wehowareReport.update({
        where: { id },
        data,
        include: {
          creator: { select: { id: true, firstName: true, lastName: true } },
          updater: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return NextResponse.json(serializeReport(report));
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      console.error("[PUT /api/v1/reports/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE (admin only)
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareReport.findFirst({
        where: { id, clientId: user.activeClientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 }
        );
      }

      await prisma.wehowareReport.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/reports/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
