/**
 * /api/v1/forms
 * GET  — list form templates (paginated)
 * POST — create a form template
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(f) {
  return {
    id: f.id, client_id: f.clientId, title: f.title, description: f.description,
    status: f.status, success_message: f.successMessage,
    redirect_url: f.redirectUrl, notification_emails: f.notificationEmails,
    created_at: f.createdAt, updated_at: f.updatedAt,
    created_by: f.createdBy, updated_by: f.updatedBy,
    _count: f._count,
  };
}

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)));
    const status = url.searchParams.get("status");
    const where = { clientId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.wehowareFormTemplate.findMany({
        where,
        include: { _count: { select: { submissions: true, fields: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareFormTemplate.count({ where }),
    ]);

    return NextResponse.json({
      data: items.map(serialize),
      pagination: { page, limit, totalItems: total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error("[GET /api/v1/forms]", err);
    return NextResponse.json({ error: "Failed to fetch forms" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const POST = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const body = await request.json();
    if (!body?.title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const form = await prisma.wehowareFormTemplate.create({
      data: {
        clientId,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? "Draft",
        successMessage: body.success_message ?? body.successMessage ?? "Thank you for your submission!",
        redirectUrl: body.redirect_url ?? body.redirectUrl ?? null,
        notificationEmails: body.notification_emails ?? body.notificationEmails ?? [],
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: { _count: { select: { submissions: true, fields: true } } },
    });
    return NextResponse.json({ data: serialize(form) }, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[POST /api/v1/forms]", err);
    return NextResponse.json({ error: "Failed to create form" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
