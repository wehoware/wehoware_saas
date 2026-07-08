/**
 * /api/v1/inquiries
 *
 * Rewritten to integrate with CRM contacts.
 * POST creates a WehowareCrmContact with source=Website instead of a
 * WehowareInquiry. Responses are serialized in the old inquiry format
 * for backward compatibility with existing admin UI and client forms.
 *
 * POST   — PUBLIC contact-form submission (rate-limited, no auth)
 * GET    — list inquiries (paginated) scoped to active client
 * PUT    — update inquiry/contact status (employee/admin)
 * DELETE — soft-delete contact (admin only)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "status",
  "name",
  "email",
  "subject",
]);
const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  status: "status",
  name: "firstName",
  email: "email",
  subject: "inquirySubject",
};

// Simple in-memory rate limiter for public POST
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { timestamp: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeContactAsInquiry(c) {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return {
    id: c.id,
    client_id: c.clientId,
    name: fullName,
    email: c.email,
    phone: c.phone,
    subject: c.inquirySubject ?? "",
    message: c.inquiryMessage ?? "",
    service_id: c.inquiryServiceId ?? null,
    status: c.status,
    ip_address: null,
    user_agent: null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    updated_by: c.updatedBy ?? null,
  };
}

// -------------------------------------------------------------------
// POST — PUBLIC (no auth) — contact form submission → CRM contact
// -------------------------------------------------------------------
export async function POST(request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, phone, subject, message, client_id, company } =
      body ?? {};

    if (!name || !email || !subject || !message || !client_id) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, email, subject, message, or client_id",
        },
        { status: 400 }
      );
    }

    const composedMessage = company
      ? `${message}\n\n--\nCompany: ${company}`
      : message;

    // Split name into first/last
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || name;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    // Dedup by [clientId, email] — upsert if exists
    const existing = await prisma.wehowareCrmContact.findFirst({
      where: { clientId: client_id, email },
    });

    if (existing) {
      const updated = await prisma.wehowareCrmContact.update({
        where: { id: existing.id },
        data: {
          inquirySubject: subject,
          inquiryMessage: composedMessage,
          phone: phone ?? existing.phone,
        },
      });
      return NextResponse.json(
        serializeContactAsInquiry(updated),
        { status: 201 }
      );
    }

    const contact = await prisma.wehowareCrmContact.create({
      data: {
        clientId: client_id,
        type: "Lead",
        status: "New",
        source: "Website",
        firstName,
        lastName,
        email,
        phone: phone ?? null,
        inquirySubject: subject,
        inquiryMessage: composedMessage,
      },
    });

    return NextResponse.json(
      serializeContactAsInquiry(contact),
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/v1/inquiries] error:", err);
    if (err?.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid client_id provided." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create inquiry" },
      { status: 500 }
    );
  }
}

// -------------------------------------------------------------------
// GET (client/employee/admin) — list contacts from Website source
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const url = new URL(request.url);

      const status = url.searchParams.get("status");
      const page = Math.max(
        1,
        Number.parseInt(url.searchParams.get("page") || "1", 10)
      );
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(
          1,
          Number.parseInt(
            url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE),
            10
          )
        )
      );
      const sortByRaw = url.searchParams.get("sort_by") || "created_at";
      const sortOrder =
        url.searchParams.get("sort_order") === "asc" ? "asc" : "desc";
      const sortBy = SORTABLE_FIELDS.has(sortByRaw)
        ? FIELD_MAP[sortByRaw]
        : "createdAt";

      const queryClientId = resolveClientId(user);
      if (!queryClientId) {
        return NextResponse.json(
          { error: "Could not determine client context for filtering inquiries." },
          { status: 400 }
        );
      }

      const where = { clientId: queryClientId, source: "Website" };
      if (status) where.status = status;

      const [items, totalItems] = await Promise.all([
        prisma.wehowareCrmContact.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareCrmContact.count({ where }),
      ]);

      const data = items.map(serializeContactAsInquiry);

      return NextResponse.json({
        data,
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/inquiries] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch inquiries" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT (employee/admin) — update contact status
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const body = await request.json();
      const { id, status } = body ?? {};

      if (!id || !status) {
        return NextResponse.json(
          { error: "Missing required fields: id and status" },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareCrmContact.findFirst({
        where: { id },
        select: { id: true, clientId: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Inquiry not found" },
          { status: 404 }
        );
      }

      const clientId = resolveClientId(user);
      if (!clientId || String(clientId) !== String(existing.clientId)) {
        return NextResponse.json(
          { error: "Unauthorized to update this inquiry." },
          { status: 403 }
        );
      }

      const updated = await prisma.wehowareCrmContact.update({
        where: { id },
        data: {
          status,
          updatedBy: user.id,
        },
      });

      return NextResponse.json({ data: serializeContactAsInquiry(updated) });
    } catch (err) {
      console.error("[PUT /api/v1/inquiries] error:", err);
      return NextResponse.json(
        { error: "Failed to update inquiry" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE (admin only) — soft-delete contact
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const url = new URL(request.url);
      const id = url.searchParams.get("id");

      if (!id) {
        return NextResponse.json(
          { error: "Missing inquiry ID in query parameters" },
          { status: 400 }
        );
      }

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Admin must have an active client context set to delete an inquiry." },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareCrmContact.findFirst({
        where: { id },
        select: { id: true, clientId: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Inquiry not found" },
          { status: 404 }
        );
      }

      if (String(existing.clientId) !== String(clientId)) {
        return NextResponse.json(
          {
            error:
              "Unauthorized: Inquiry does not belong to the admin's active client context.",
          },
          { status: 403 }
        );
      }

      await prisma.wehowareCrmContact.update({
        where: { id },
        data: { active: false, updatedBy: user.id },
      });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/inquiries] error:", err);
      return NextResponse.json(
        { error: "Failed to delete inquiry" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
