/**
 * /api/v1/forms/[id]/submissions/[submissionId]
 * GET / PUT / DELETE for a single form submission
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

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

async function load(prisma, user, formId, submissionId) {
  const clientId = resolveClientId(user);
  if (!clientId) return { status: 400, body: { error: "Active client context required" } };
  const form = await prisma.wehowareFormTemplate.findFirst({ where: { id: formId, clientId }, select: { id: true } });
  if (!form) return { status: 404, body: { error: "Form not found" } };
  const submission = await prisma.wehowareFormSubmission.findFirst({ where: { id: submissionId, formTemplateId: formId } });
  if (!submission) return { status: 404, body: { error: "Submission not found" } };
  return { status: 200, data: submission };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: formId, submissionId } = await params;
    const res = await load(prisma, user, formId, submissionId);
    if (res.status !== 200) return NextResponse.json(res.body, { status: res.status });
    return NextResponse.json({ data: serialize(res.data) });
  } catch (err) {
    console.error("[GET /api/v1/forms/[id]/submissions/[submissionId]]", err);
    return NextResponse.json({ error: "Failed to fetch submission" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: formId, submissionId } = await params;
    const auth = await load(prisma, user, formId, submissionId);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });

    const body = await request.json();
    const data = { updatedBy: user.id };
    if (body.status !== undefined) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.tags !== undefined) data.tags = body.tags;

    if (Object.keys(data).length === 1) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    const updated = await prisma.wehowareFormSubmission.update({ where: { id: submissionId }, data });
    return NextResponse.json({ data: serialize(updated) });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[PUT /api/v1/forms/[id]/submissions/[submissionId]]", err);
    return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id: formId, submissionId } = await params;
    const auth = await load(prisma, user, formId, submissionId);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });
    await prisma.wehowareFormSubmission.delete({ where: { id: submissionId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v1/forms/[id]/submissions/[submissionId]]", err);
    return NextResponse.json({ error: "Failed to delete submission" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
