/**
 * /api/v1/inquiries
 *
 * Prisma/MySQL-backed replacement for the old Supabase handler.
 *
 * POST   — PUBLIC contact-form submission (no auth)
 * GET    — list inquiries (paginated) scoped to active client
 * PUT    — update inquiry status (employee/admin)
 * DELETE — delete inquiry (admin only)
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
  name: "name",
  email: "email",
  subject: "subject",
};

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

// -------------------------------------------------------------------
// POST — PUBLIC (no auth) — contact form submission
// -------------------------------------------------------------------
export async function POST(request) {
  try {
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

    // Some existing forms send `company` as part of the message; we fold it
    // into the message body so it's preserved without schema changes.
    const composedMessage = company
      ? `${message}\n\n--\nCompany: ${company}`
      : message;

    const inquiry = await prisma.wehowareInquiry.create({
      data: {
        clientId: client_id,
        name,
        email,
        phone: phone ?? null,
        subject,
        message: composedMessage,
        status: "New",
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown",
        userAgent: request.headers.get("user-agent") ?? "unknown",
      },
    });

    return NextResponse.json(inquiry, { status: 201 });
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
// GET (client/employee/admin)
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const url = new URL(request.url);

      const filterClientIdParam = url.searchParams.get("client_id");
      const status = url.searchParams.get("status");
      const page = Math.max(
        1,
        parseInt(url.searchParams.get("page") || "1", 10)
      );
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(
          1,
          parseInt(
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

      // Resolve client context
      let queryClientId = null;
      if (user.role === "client") {
        queryClientId = user.clientId;
        if (
          filterClientIdParam &&
          String(filterClientIdParam) !== String(queryClientId)
        ) {
          return NextResponse.json(
            { error: "Clients can only filter by their own client ID." },
            { status: 403 }
          );
        }
      } else if (["employee", "admin"].includes(user.role)) {
        if (user.activeClientId) {
          queryClientId = user.activeClientId;
          if (
            filterClientIdParam &&
            String(filterClientIdParam) !== String(queryClientId)
          ) {
            return NextResponse.json(
              {
                error:
                  "Employees/Admins can only view inquiries for their active client context.",
              },
              { status: 403 }
            );
          }
        } else {
          return NextResponse.json(
            {
              error:
                "Active client context required for employees/admins.",
            },
            { status: 400 }
          );
        }
      }

      if (!queryClientId) {
        return NextResponse.json(
          {
            error:
              "Could not determine client context for filtering inquiries.",
          },
          { status: 400 }
        );
      }

      const where = { clientId: queryClientId };
      if (status) where.status = status;

      const [items, totalItems] = await Promise.all([
        prisma.wehowareInquiry.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareInquiry.count({ where }),
      ]);

      // Map camelCase → snake_case for backward-compatibility with the
      // admin UI that expects the old column names.
      const data = items.map((i) => ({
        id: i.id,
        client_id: i.clientId,
        name: i.name,
        email: i.email,
        phone: i.phone,
        subject: i.subject,
        message: i.message,
        service_id: i.serviceId,
        status: i.status,
        ip_address: i.ipAddress,
        user_agent: i.userAgent,
        created_at: i.createdAt,
        updated_at: i.updatedAt,
        updated_by: i.updatedBy,
      }));

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
// PUT (employee/admin) — update status
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

      const existing = await prisma.wehowareInquiry.findUnique({
        where: { id },
        select: { id: true, clientId: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Inquiry not found" },
          { status: 404 }
        );
      }

      // Employee/admin must have active client context matching the inquiry
      if (
        !user.activeClientId ||
        String(user.activeClientId) !== String(existing.clientId)
      ) {
        return NextResponse.json(
          { error: "Unauthorized to update this inquiry." },
          { status: 403 }
        );
      }

      const updated = await prisma.wehowareInquiry.update({
        where: { id },
        data: {
          status,
          updatedBy: user.id,
        },
      });

      return NextResponse.json({ data: updated });
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
// DELETE (admin only)
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

      if (!user.activeClientId) {
        return NextResponse.json(
          {
            error:
              "Admin must have an active client context set to delete an inquiry.",
          },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareInquiry.findUnique({
        where: { id },
        select: { id: true, clientId: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Inquiry not found" },
          { status: 404 }
        );
      }

      if (String(existing.clientId) !== String(user.activeClientId)) {
        return NextResponse.json(
          {
            error:
              "Unauthorized: Inquiry does not belong to the admin's active client context.",
          },
          { status: 403 }
        );
      }

      await prisma.wehowareInquiry.delete({ where: { id } });
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
