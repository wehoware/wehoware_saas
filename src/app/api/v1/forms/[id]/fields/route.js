/**
 * /api/v1/forms/[id]/fields
 * GET — list fields for a form
 * POST — create a field
 * PUT  — batch replace all fields
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(f) {
  return {
    id: f.id, client_id: f.clientId, form_template_id: f.formTemplateId,
    field_type: f.fieldType, label: f.label, placeholder: f.placeholder,
    help_text: f.helpText, required: f.required, field_order: f.fieldOrder,
    default_value: f.defaultValue, options: f.options,
    validation_rules: f.validationRules, css_class: f.cssClass,
    created_at: f.createdAt, updated_at: f.updatedAt,
  };
}

async function canAccessForm(prisma, user, formId) {
  const clientId = resolveClientId(user);
  if (!clientId) return null;
  return prisma.wehowareFormTemplate.findFirst({ where: { id: formId, clientId }, select: { id: true, clientId: true } });
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: formId } = await params;
    const form = await canAccessForm(prisma, user, formId);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const fields = await prisma.wehowareFormField.findMany({
      where: { formTemplateId: formId },
      orderBy: { fieldOrder: "asc" },
    });
    return NextResponse.json({ data: fields.map(serialize) });
  } catch (err) {
    console.error("[GET /api/v1/forms/[id]/fields]", err);
    return NextResponse.json({ error: "Failed to fetch fields" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const POST = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: formId } = await params;
    const form = await canAccessForm(prisma, user, formId);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const body = await request.json();
    if (!body?.field_type || !body?.label) return NextResponse.json({ error: "field_type and label are required" }, { status: 400 });

    const field = await prisma.wehowareFormField.create({
      data: {
        clientId: form.clientId,
        formTemplateId: formId,
        fieldType: body.field_type ?? body.fieldType,
        label: body.label,
        placeholder: body.placeholder ?? null,
        helpText: body.help_text ?? body.helpText ?? null,
        required: body.required ?? false,
        fieldOrder: body.field_order ?? body.fieldOrder ?? 0,
        defaultValue: body.default_value ?? body.defaultValue ?? null,
        options: body.options ?? [],
        validationRules: body.validation_rules ?? body.validationRules ?? {},
        cssClass: body.css_class ?? body.cssClass ?? null,
      },
    });
    return NextResponse.json({ data: serialize(field) }, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[POST /api/v1/forms/[id]/fields]", err);
    return NextResponse.json({ error: "Failed to create field" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

// Batch replace — accepts { fields: [] }, deletes old and creates new in a transaction
export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: formId } = await params;
    const form = await canAccessForm(prisma, user, formId);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const body = await request.json();
    if (!Array.isArray(body?.fields)) return NextResponse.json({ error: "fields array is required" }, { status: 400 });

    const fields = await prisma.$transaction(async (tx) => {
      await tx.wehowareFormField.deleteMany({ where: { formTemplateId: formId } });
      const created = await Promise.all(body.fields.map((f, index) =>
        tx.wehowareFormField.create({
          data: {
            clientId: form.clientId,
            formTemplateId: formId,
            fieldType: f.field_type ?? f.fieldType,
            label: f.label,
            placeholder: f.placeholder ?? null,
            helpText: f.help_text ?? f.helpText ?? null,
            required: f.required ?? false,
            fieldOrder: f.field_order ?? f.fieldOrder ?? index,
            defaultValue: f.default_value ?? f.defaultValue ?? null,
            options: f.options ?? [],
            validationRules: f.validation_rules ?? f.validationRules ?? {},
            cssClass: f.css_class ?? f.cssClass ?? null,
          },
        })
      ));
      return created;
    });

    return NextResponse.json({ data: fields.map(serialize) });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[PUT /api/v1/forms/[id]/fields]", err);
    return NextResponse.json({ error: "Failed to replace fields" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
