/**
 * /api/v1/forms/[id]
 * GET / PUT / DELETE for a single form template (with nested fields)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serializeField(f) {
  return {
    id: f.id, client_id: f.clientId, form_template_id: f.formTemplateId,
    field_type: f.fieldType, label: f.label, placeholder: f.placeholder,
    help_text: f.helpText, required: f.required, field_order: f.fieldOrder,
    default_value: f.defaultValue, options: f.options, validation_rules: f.validationRules,
    css_class: f.cssClass, created_at: f.createdAt, updated_at: f.updatedAt,
  };
}

function serialize(f) {
  return {
    id: f.id, client_id: f.clientId, title: f.title, description: f.description,
    status: f.status, success_message: f.successMessage,
    redirect_url: f.redirectUrl, notification_emails: f.notificationEmails,
    created_at: f.createdAt, updated_at: f.updatedAt,
    created_by: f.createdBy, updated_by: f.updatedBy,
    fields: f.fields?.map(serializeField) ?? [],
    _count: f._count,
  };
}

async function load(prisma, user, id) {
  const clientId = resolveClientId(user);
  if (!clientId) return { status: 400, body: { error: "Active client context required" } };
  const form = await prisma.wehowareFormTemplate.findFirst({
    where: { id, clientId },
    include: {
      fields: { orderBy: { fieldOrder: "asc" } },
      _count: { select: { submissions: true } },
    },
  });
  if (!form) return { status: 404, body: { error: "Form not found" } };
  return { status: 200, data: form };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const res = await load(prisma, user, id);
    if (res.status !== 200) return NextResponse.json(res.body, { status: res.status });
    return NextResponse.json({ data: serialize(res.data) });
  } catch (err) {
    console.error("[GET /api/v1/forms/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch form" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

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
    if (body.status !== undefined) data.status = body.status;
    if (body.success_message !== undefined || body.successMessage !== undefined) data.successMessage = body.success_message ?? body.successMessage;
    if (body.redirect_url !== undefined || body.redirectUrl !== undefined) data.redirectUrl = body.redirect_url ?? body.redirectUrl;
    if (body.notification_emails !== undefined || body.notificationEmails !== undefined) data.notificationEmails = body.notification_emails ?? body.notificationEmails;

    if (Object.keys(data).length === 1) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    const updated = await prisma.wehowareFormTemplate.update({
      where: { id },
      data,
      include: { fields: { orderBy: { fieldOrder: "asc" } }, _count: { select: { submissions: true } } },
    });
    return NextResponse.json({ data: serialize(updated) });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[PUT /api/v1/forms/[id]]", err);
    return NextResponse.json({ error: "Failed to update form" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const auth = await load(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });
    await prisma.wehowareFormTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v1/forms/[id]]", err);
    return NextResponse.json({ error: "Failed to delete form" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
