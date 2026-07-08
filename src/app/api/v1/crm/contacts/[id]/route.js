/**
 * /api/v1/crm/contacts/[id]
 * GET    — single contact with relations
 * PUT    — update contact
 * DELETE — soft-delete (active=false) if related records exist, hard delete otherwise
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

const VALID_TYPES = new Set(["Lead", "Customer"]);
const VALID_STATUSES = new Set(["New", "Contacted", "Qualified", "Unqualified", "Converted"]);
const VALID_SOURCES = new Set([
  "Website", "SocialMedia", "FormBuilder", "Appointment",
  "PhoneCall", "Email", "Manual", "Referral", "Event", "Other",
]);

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    client_id: row.clientId,
    type: row.type,
    status: row.status,
    source: row.source,
    first_name: row.firstName ?? null,
    last_name: row.lastName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    company: row.company ?? null,
    job_title: row.jobTitle ?? null,
    avatar_url: row.avatarUrl ?? null,
    website: row.website ?? null,
    linkedin_url: row.linkedinUrl ?? null,
    social_profiles: row.socialProfiles ?? null,
    social_platform: row.socialPlatform ?? null,
    social_inbox_conversation_id: row.socialInboxConversationId ?? null,
    form_submission_id: row.formSubmissionId ?? null,
    appointment_id: row.appointmentId ?? null,
    accounting_customer_id: row.accountingCustomerId ?? null,
    inquiry_subject: row.inquirySubject ?? null,
    inquiry_message: row.inquiryMessage ?? null,
    inquiry_service_id: row.inquiryServiceId ?? null,
    notes: row.notes ?? null,
    tags: row.tags ?? null,
    custom_fields: row.customFields ?? null,
    assigned_to: row.assignedTo ?? null,
    active: row.active,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    created_by: row.createdBy ?? null,
    updated_by: row.updatedBy ?? null,
    activities: (row.activities || []).map((a) => ({
      id: a.id,
      type: a.type,
      direction: a.direction,
      title: a.title,
      description: a.description ?? null,
      scheduled_at: a.scheduledAt ?? null,
      completed_at: a.completedAt ?? null,
      duration_minutes: a.durationMinutes ?? null,
      created_at: a.createdAt,
    })),
    deals: (row.deals || []).map((d) => ({
      id: d.id,
      title: d.title,
      value: d.value,
      currency: d.currency,
      status: d.status,
      pipeline_id: d.pipelineId,
      stage_id: d.stageId,
    })),
    _count: row._count ?? null,
  };
}

async function loadContact(prisma, clientId, contactId) {
  return prisma.wehowareCrmContact.findFirst({
    where: { id: contactId, clientId },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 20 },
      deals: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { deals: true, activities: true, listMemberships: true } },
    },
  });
}

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }
      const { id } = await params;
      const contact = await loadContact(prisma, clientId, id);
      if (!contact) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
      return NextResponse.json({ data: serialize(contact) });
    } catch (err) {
      console.error("[GET /api/v1/crm/contacts/[id]] error:", err);
      return NextResponse.json({ error: "Failed to fetch contact" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }
      const { id } = await params;
      const existing = await prisma.wehowareCrmContact.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const data = { updatedBy: user.id };

      if (body.first_name !== undefined) data.firstName = body.first_name;
      if (body.last_name !== undefined) data.lastName = body.last_name;
      if (body.email !== undefined) data.email = body.email;
      if (body.phone !== undefined) data.phone = body.phone;
      if (body.company !== undefined) data.company = body.company;
      if (body.job_title !== undefined) data.jobTitle = body.job_title;
      if (body.website !== undefined) data.website = body.website;
      if (body.linkedin_url !== undefined) data.linkedinUrl = body.linkedin_url;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.tags !== undefined) data.tags = body.tags;
      if (body.custom_fields !== undefined) data.customFields = body.custom_fields;
      if (body.assigned_to !== undefined) data.assignedTo = body.assigned_to;

      if (body.type !== undefined) {
        if (!VALID_TYPES.has(body.type)) {
          return NextResponse.json({ error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(", ")}` }, { status: 400 });
        }
        data.type = body.type;
      }
      if (body.status !== undefined) {
        if (!VALID_STATUSES.has(body.status)) {
          return NextResponse.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
        }
        data.status = body.status;
      }
      if (body.source !== undefined) {
        if (!VALID_SOURCES.has(body.source)) {
          return NextResponse.json({ error: `Invalid source. Must be one of: ${[...VALID_SOURCES].join(", ")}` }, { status: 400 });
        }
        data.source = body.source;
      }
      if (body.active !== undefined) data.active = body.active;

      if (Object.keys(data).length === 1) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const updated = await prisma.wehowareCrmContact.update({
        where: { id },
        data,
        include: {
          _count: { select: { deals: true, activities: true, listMemberships: true } },
        },
      });

      return NextResponse.json({ data: serialize(updated) });
    } catch (err) {
      console.error("[PUT /api/v1/crm/contacts/[id]] error:", err);
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A contact with this email already exists for this client" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }
      const { id } = await params;
      const existing = await prisma.wehowareCrmContact.findFirst({
        where: { id, clientId },
        select: { id: true, _count: { select: { deals: true, activities: true, listMemberships: true } } },
      });
      if (!existing) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      const hasRelations =
        existing._count.deals > 0 ||
        existing._count.activities > 0 ||
        existing._count.listMemberships > 0;

      if (hasRelations) {
        await prisma.wehowareCrmContact.update({
          where: { id },
          data: { active: false, updatedBy: user.id },
        });
        return NextResponse.json({ data: { id, active: false, archived: true } });
      }

      await prisma.wehowareCrmContact.delete({ where: { id } });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (err) {
      console.error("[DELETE /api/v1/crm/contacts/[id]] error:", err);
      return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
