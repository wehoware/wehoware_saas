/**
 * /api/v1/crm/contacts
 * GET  — paginated list with search, filter, sort
 * POST — create a new CRM contact
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VALID_SORT_FIELDS = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  company: "company",
  status: "status",
  source: "source",
};

const VALID_TYPES = new Set(["Lead", "Customer"]);
const VALID_STATUSES = new Set(["New", "Contacted", "Qualified", "Unqualified", "Converted"]);
const VALID_SOURCES = new Set([
  "Website", "SocialMedia", "FormBuilder", "Appointment",
  "PhoneCall", "Email", "Manual", "Referral", "Event", "Other",
]);

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

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
    _count: row._count ?? null,
  };
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "No client context resolved." },
          { status: 400 }
        );
      }

      const { searchParams } = new URL(request.url);
      const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10))
      );

      const search = searchParams.get("search")?.trim() || "";
      const type = searchParams.get("type");
      const status = searchParams.get("status");
      const source = searchParams.get("source");
      const active = searchParams.get("active");
      const assignedTo = searchParams.get("assigned_to");
      const sortBy = searchParams.get("sortBy") || "createdAt";
      const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

      if (type && !VALID_TYPES.has(type)) {
        return NextResponse.json({ error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(", ")}` }, { status: 400 });
      }
      if (status && !VALID_STATUSES.has(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
      }
      if (source && !VALID_SOURCES.has(source)) {
        return NextResponse.json({ error: `Invalid source. Must be one of: ${[...VALID_SOURCES].join(", ")}` }, { status: 400 });
      }

      const sortField = VALID_SORT_FIELDS[sortBy] || "createdAt";

      const where = { clientId };
      if (type) where.type = type;
      if (status) where.status = status;
      if (source) where.source = source;
      if (assignedTo) where.assignedTo = assignedTo;
      if (active !== null && active !== undefined) {
        if (active === "true") where.active = true;
        if (active === "false") where.active = false;
      } else {
        where.active = true;
      }
      if (search) {
        where.OR = [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { company: { contains: search } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.wehowareCrmContact.findMany({
          where,
          include: {
            _count: { select: { deals: true, activities: true } },
          },
          orderBy: { [sortField]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareCrmContact.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serialize),
        pagination: {
          totalItems: total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/crm/contacts] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch contacts" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "No client context resolved." },
          { status: 400 }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const {
        first_name,
        last_name,
        email,
        phone,
        company,
        job_title,
        website,
        linkedin_url,
        notes,
        tags,
        type = "Lead",
        status = "New",
        source = "Manual",
        assigned_to,
        custom_fields,
      } = body ?? {};

      if (!first_name && !last_name && !email) {
        return NextResponse.json(
          { error: "At least one of first_name, last_name, or email is required" },
          { status: 400 }
        );
      }

      if (!VALID_TYPES.has(type)) {
        return NextResponse.json({ error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(", ")}` }, { status: 400 });
      }
      if (!VALID_STATUSES.has(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
      }
      if (!VALID_SOURCES.has(source)) {
        return NextResponse.json({ error: `Invalid source. Must be one of: ${[...VALID_SOURCES].join(", ")}` }, { status: 400 });
      }

      // Dedup by [clientId, email]
      if (email) {
        const existing = await prisma.wehowareCrmContact.findFirst({
          where: { clientId, email },
        });
        if (existing) {
          const updated = await prisma.wehowareCrmContact.update({
            where: { id: existing.id },
            data: {
              firstName: first_name ?? existing.firstName,
              lastName: last_name ?? existing.lastName,
              phone: phone ?? existing.phone,
              company: company ?? existing.company,
              jobTitle: job_title ?? existing.jobTitle,
              website: website ?? existing.website,
              linkedinUrl: linkedin_url ?? existing.linkedinUrl,
              notes: notes ?? existing.notes,
              tags: tags ?? existing.tags,
              customFields: custom_fields ?? existing.customFields,
              updatedBy: user.id,
            },
            include: { _count: { select: { deals: true, activities: true } } },
          });
          return NextResponse.json({ data: serialize(updated) });
        }
      }

      const created = await prisma.wehowareCrmContact.create({
        data: {
          clientId,
          type,
          status,
          source,
          firstName: first_name ?? null,
          lastName: last_name ?? null,
          email: email ?? null,
          phone: phone ?? null,
          company: company ?? null,
          jobTitle: job_title ?? null,
          website: website ?? null,
          linkedinUrl: linkedin_url ?? null,
          notes: notes ?? null,
          tags: tags ?? [],
          customFields: custom_fields ?? null,
          assignedTo: assigned_to ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: { _count: { select: { deals: true, activities: true } } },
      });

      return NextResponse.json({ data: serialize(created) }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/crm/contacts] error:", err);
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A contact with this email already exists for this client" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create contact" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
