/**
 * /api/v1/reports
 *
 * Prisma/MySQL-backed replacement. Note the underlying schema shape has
 * changed from the pre-migration Supabase version: reports now reference a
 * `templateId` (from wehoware_report_templates) and use JSON `reportData`
 * + date-range fields instead of `type` + free-form `content`. Callers that
 * used the old fields should update their payloads.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

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
  };
}

// -------------------------------------------------------------------
// GET — list reports
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10))
      );
      const status = url.searchParams.get("status") || "";
      const sortOrder =
        url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

      const where = { clientId };
      if (status) where.status = status;

      const [items, totalItems] = await Promise.all([
        prisma.wehowareReport.findMany({
          where,
          include: {
            creator: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareReport.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serializeReport),
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/reports] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch reports" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST — create a report
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const title = body?.title;
      const templateId = body?.template_id ?? body?.templateId;

      if (!title || !templateId) {
        return NextResponse.json(
          { error: "title and template_id are required" },
          { status: 400 }
        );
      }

      const report = await prisma.wehowareReport.create({
        data: {
          clientId: user.activeClientId,
          templateId,
          title,
          description: body.description ?? null,
          reportData: body.report_data ?? body.reportData ?? null,
          dateRangeStart: body.date_range_start
            ? new Date(body.date_range_start)
            : null,
          dateRangeEnd: body.date_range_end
            ? new Date(body.date_range_end)
            : null,
          status: body.status ?? "Draft",
          isScheduled: body.is_scheduled ?? false,
          scheduleFrequency: body.schedule_frequency ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: {
          creator: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return NextResponse.json(serializeReport(report), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/reports] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid template_id" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
