/**
 * /api/v1/crm/lists/[id]
 * GET    — single list with member contacts
 * PUT    — update list metadata
 * DELETE — delete list (cascades memberships)
 * POST   — add contacts to list (bulk)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serializeList(l) {
  return {
    id: l.id,
    client_id: l.clientId,
    name: l.name,
    description: l.description ?? null,
    color: l.color ?? null,
    active: l.active,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
    created_by: l.createdBy ?? null,
    updated_by: l.updatedBy ?? null,
    member_count: l._count?.memberships ?? 0,
    members: (l.memberships || []).map((m) => ({
      id: m.id,
      contact_id: m.contactId,
      added_at: m.createdAt,
      contact: m.contact ? {
        id: m.contact.id,
        first_name: m.contact.firstName,
        last_name: m.contact.lastName,
        email: m.contact.email,
        company: m.contact.company,
        status: m.contact.status,
      } : null,
    })),
  };
}

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      const { id } = await params;

      const list = await prisma.wehowareCrmContactList.findFirst({
        where: { id, clientId },
        include: {
          _count: { select: { memberships: true } },
          memberships: {
            include: {
              contact: { select: { id: true, firstName: true, lastName: true, email: true, company: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

      return NextResponse.json({ data: serializeList(list) });
    } catch (err) {
      console.error("[GET /api/v1/crm/lists/[id]] error:", err);
      return NextResponse.json({ error: "Failed to fetch list" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      const { id } = await params;

      const existing = await prisma.wehowareCrmContactList.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "List not found" }, { status: 404 });

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const data = { updatedBy: user.id };
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.color !== undefined) data.color = body.color;
      if (body.active !== undefined) data.active = body.active;

      if (Object.keys(data).length === 1) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const updated = await prisma.wehowareCrmContactList.update({
        where: { id },
        data,
        include: { _count: { select: { memberships: true } } },
      });

      return NextResponse.json({ data: serializeList(updated) });
    } catch (err) {
      console.error("[PUT /api/v1/crm/lists/[id]] error:", err);
      return NextResponse.json({ error: "Failed to update list" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      const { id } = await params;

      const existing = await prisma.wehowareCrmContactList.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "List not found" }, { status: 404 });

      await prisma.wehowareCrmContactList.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/crm/lists/[id]] error:", err);
      return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
