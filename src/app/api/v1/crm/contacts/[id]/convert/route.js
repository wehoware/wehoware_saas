/**
 * /api/v1/crm/contacts/[id]/convert
 * POST — convert a Lead contact to Customer status
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
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }
      const { id } = await params;

      const existing = await prisma.wehowareCrmContact.findFirst({
        where: { id, clientId },
        select: { id: true, type: true, status: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      const updated = await prisma.wehowareCrmContact.update({
        where: { id },
        data: {
          type: "Customer",
          status: "Converted",
          updatedBy: user.id,
        },
      });

      await prisma.wehowareCrmActivity.create({
        data: {
          clientId,
          contactId: id,
          type: "Note",
          direction: "Internal",
          title: "Contact converted to Customer",
          description: "Lead was converted to Customer status",
          completedAt: new Date(),
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return NextResponse.json({
        data: {
          id: updated.id,
          type: updated.type,
          status: updated.status,
        },
      });
    } catch (err) {
      console.error("[POST /api/v1/crm/contacts/[id]/convert] error:", err);
      return NextResponse.json({ error: "Failed to convert contact" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
