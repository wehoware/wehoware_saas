/**
 * /api/v1/forms/[id]/submissions
 * GET — list submissions (paginated)
 * DELETE — bulk delete by ids array in body
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

function serialize(s) {
  return {
    id: s.id, client_id: s.clientId, form_template_id: s.formTemplateId,
    submission_data: s.submissionData, submitted_at: s.submittedAt,
    ip_address: s.ipAddress, user_agent: s.userAgent,
    status: s.status, notes: s.notes, tags: s.tags,
    updated_at: s.updatedAt, updated_by: s.updatedBy,
  };
}

async function canAccessForm(prisma, user, formId) {
  const clientId = resolveClientId(user);
  if (!clientId) return null;
  return prisma.wehowareFormTemplate.findFirst({ where: { id: formId, clientId }, select: { id: true } });
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: formId } = await params;
    const form = await canAccessForm(prisma, user, formId);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)));
    const status = url.searchParams.get("status");
    const where = { formTemplateId: formId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.wehowareFormSubmission.findMany({
        where, orderBy: { submittedAt: "desc" }, skip: (page - 1) * limit, take: limit,
      }),
      prisma.wehowareFormSubmission.count({ where }),
    ]);

    return NextResponse.json({
      data: items.map(serialize),
      pagination: { page, limit, totalItems: total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error("[GET /api/v1/forms/[id]/submissions]", err);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: formId } = await params;
    const form = await canAccessForm(prisma, user, formId);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const body = await request.json();
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "ids array is required" }, { status: 400 });

    const result = await prisma.wehowareFormSubmission.deleteMany({
      where: { id: { in: ids }, formTemplateId: formId },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[DELETE /api/v1/forms/[id]/submissions]", err);
    return NextResponse.json({ error: "Failed to delete submissions" }, { status: 500 });
  }
}, { allowedRoles: ["admin"] });
