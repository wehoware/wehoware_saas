/**
 * /api/v1/report-templates/[id]
 * GET / PUT / DELETE for a single report template
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

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

async function load(prisma, user, id) {
  const clientId = resolveClientId(user);
  if (!clientId) return { status: 400, body: { error: "Active client context required" } };
  const t = await prisma.wehowareReportTemplate.findFirst({ where: { id, clientId } });
  if (!t) return { status: 404, body: { error: "Report template not found" } };
  return { status: 200, data: t };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const res = await load(prisma, user, id);
    if (res.status !== 200) return NextResponse.json(res.body, { status: res.status });
    return NextResponse.json({ data: serialize(res.data) });
  } catch (err) {
    console.error("[GET /api/v1/report-templates/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch report template" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const auth = await load(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });

    const body = await request.json();
    const data = { updatedBy: user.id };
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.report_type !== undefined || body.reportType !== undefined) data.reportType = body.report_type ?? body.reportType;
    if (body.layout !== undefined) data.layout = body.layout;
    if (body.components !== undefined) data.components = body.components;
    if (body.is_system_template !== undefined) data.isSystemTemplate = Boolean(body.is_system_template);

    if (Object.keys(data).length === 1) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    const updated = await prisma.wehowareReportTemplate.update({ where: { id }, data });
    return NextResponse.json({ data: serialize(updated) });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[PUT /api/v1/report-templates/[id]]", err);
    return NextResponse.json({ error: "Failed to update report template" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const auth = await load(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });
    await prisma.wehowareReportTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v1/report-templates/[id]]", err);
    return NextResponse.json({ error: "Failed to delete report template" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
