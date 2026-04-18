/**
 * /api/v1/report-templates
 * GET / POST for report templates
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(t) {
  return {
    id: t.id, client_id: t.clientId, title: t.title, description: t.description,
    report_type: t.reportType, layout: t.layout, components: t.components,
    is_system_template: t.isSystemTemplate,
    created_at: t.createdAt, updated_at: t.updatedAt,
    created_by: t.createdBy, updated_by: t.updatedBy,
  };
}

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const url = new URL(request.url);
    const reportType = url.searchParams.get("report_type");
    const where = { clientId };
    if (reportType) where.reportType = reportType;

    const templates = await prisma.wehowareReportTemplate.findMany({
      where, orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: templates.map(serialize) });
  } catch (err) {
    console.error("[GET /api/v1/report-templates]", err);
    return NextResponse.json({ error: "Failed to fetch report templates" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });

export const POST = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const body = await request.json();
    const reportType = body?.report_type ?? body?.reportType;
    if (!body?.title || !reportType) {
      return NextResponse.json({ error: "title and report_type are required" }, { status: 400 });
    }

    const template = await prisma.wehowareReportTemplate.create({
      data: {
        clientId,
        title: body.title,
        description: body.description ?? null,
        reportType,
        layout: body.layout ?? null,
        components: body.components ?? null,
        isSystemTemplate: body.is_system_template ?? false,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    return NextResponse.json({ data: serialize(template) }, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[POST /api/v1/report-templates]", err);
    return NextResponse.json({ error: "Failed to create report template" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
