/**
 * POST /api/v1/inventory/bulk
 *
 * Bulk operations on inventory items within the active client context.
 *
 * Body: { action: "activate" | "deactivate" | "delete", ids: string[] }
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const VALID_ACTIONS = new Set(["activate", "deactivate", "delete"]);

function canManageItems(user) {
  if (user.role === "client") {
    return ["client", "manager", "editor"].includes(user.activeClientRole);
  }
  return true;
}

export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      if (!canManageItems(user)) {
        return NextResponse.json({ error: "Forbidden - Requires owner, manager, or editor role" }, { status: 403 });
      }

      const clientId = user.activeClientId;
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const body = await request.json();
      const { action, ids } = body ?? {};

      if (!VALID_ACTIONS.has(action)) {
        return NextResponse.json(
          { error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(", ")}` },
          { status: 400 }
        );
      }
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
      }
      if (ids.length > 100) {
        return NextResponse.json({ error: "Maximum 100 ids per bulk operation" }, { status: 400 });
      }

      const where = { clientId, id: { in: ids } };

      if (action === "delete") {
        const { count } = await prisma.wehowareInventoryItem.deleteMany({ where });
        return NextResponse.json({ deleted: count, updated: 0 });
      }

      const { count } = await prisma.wehowareInventoryItem.updateMany({
        where,
        data: {
          active: action === "activate",
          updatedBy: user.id,
        },
      });

      return NextResponse.json({ updated: count, deleted: 0 });
    } catch (err) {
      console.error("[POST /api/v1/inventory/bulk] error:", err);
      return NextResponse.json({ error: "Bulk operation failed" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
