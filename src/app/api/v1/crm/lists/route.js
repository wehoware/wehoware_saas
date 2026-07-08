/**
 * /api/v1/crm/lists
 * GET  — list contact lists for active client
 * POST — create a new contact list
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

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
  };
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }

      const lists = await prisma.wehowareCrmContactList.findMany({
        where: { clientId },
        include: { _count: { select: { memberships: true } } },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ data: lists.map(serializeList) });
    } catch (err) {
      console.error("[GET /api/v1/crm/lists] error:", err);
      return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
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
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { name, description, color } = body ?? {};
      if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }

      const list = await prisma.wehowareCrmContactList.create({
        data: {
          clientId,
          name,
          description: description ?? null,
          color: color ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: { _count: { select: { memberships: true } } },
      });

      return NextResponse.json({ data: serializeList(list) }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/crm/lists] error:", err);
      return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
