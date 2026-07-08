/**
 * /api/v1/crm/lists/[id]/members
 * POST   — add contacts to list (bulk)
 * DELETE — remove contacts from list (bulk via body or query)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      const { id: listId } = await params;

      const list = await prisma.wehowareCrmContactList.findFirst({
        where: { id: listId, clientId },
        select: { id: true },
      });
      if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { contact_ids } = body ?? {};
      if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
        return NextResponse.json({ error: "contact_ids array is required" }, { status: 400 });
      }

      // Verify all contacts belong to this client
      const validContacts = await prisma.wehowareCrmContact.findMany({
        where: { id: { in: contact_ids }, clientId },
        select: { id: true },
      });
      const validIds = new Set(validContacts.map((c) => c.id));

      // Create memberships (skip duplicates)
      const memberships = [];
      for (const contactId of contact_ids) {
        if (!validIds.has(contactId)) continue;
        try {
          const m = await prisma.wehowareCrmContactListMembership.create({
            data: { listId, contactId, clientId },
          });
          memberships.push(m);
        } catch {
          // Duplicate — skip
        }
      }

      return NextResponse.json({
        data: { added: memberships.length, skipped: contact_ids.length - memberships.length },
      }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/crm/lists/[id]/members] error:", err);
      return NextResponse.json({ error: "Failed to add members" }, { status: 500 });
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
      const { id: listId } = await params;

      const list = await prisma.wehowareCrmContactList.findFirst({
        where: { id: listId, clientId },
        select: { id: true },
      });
      if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

      let contactIds = [];
      const { searchParams } = new URL(request.url);
      const queryIds = searchParams.get("contact_ids");
      if (queryIds) {
        contactIds = queryIds.split(",");
      } else {
        try {
          const body = await request.json();
          contactIds = body.contact_ids || [];
        } catch {
          // No body — can't proceed
        }
      }

      if (contactIds.length === 0) {
        return NextResponse.json({ error: "contact_ids required (query or body)" }, { status: 400 });
      }

      const result = await prisma.wehowareCrmContactListMembership.deleteMany({
        where: { listId, contactId: { in: contactIds } },
      });

      return NextResponse.json({ data: { removed: result.count } });
    } catch (err) {
      console.error("[DELETE /api/v1/crm/lists/[id]/members] error:", err);
      return NextResponse.json({ error: "Failed to remove members" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
