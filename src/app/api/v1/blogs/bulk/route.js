/**
 * POST /api/v1/blogs/bulk
 *
 * Bulk operations on blogs within the active client context.
 *
 * Body: { action: "publish" | "unpublish" | "archive" | "delete", ids: string[] }
 *
 * Returns: { updated: number, deleted: number }
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const VALID_ACTIONS = new Set(["publish", "unpublish", "archive", "delete"]);

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  return user.activeClientId ?? null;
}

export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
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
        const { count } = await prisma.wehowareBlog.deleteMany({ where });
        return NextResponse.json({ deleted: count, updated: 0 });
      }

      const statusMap = { publish: "Published", unpublish: "Draft", archive: "Archived" };
      const newStatus = statusMap[action];
      const now = new Date();

      const updateData = { status: newStatus, updatedBy: user.id };
      if (action === "publish") {
        // Only stamp publishedAt on rows that don't already have one
        const unpublished = await prisma.wehowareBlog.findMany({
          where: { ...where, publishedAt: null },
          select: { id: true },
        });
        if (unpublished.length > 0) {
          await prisma.wehowareBlog.updateMany({
            where: { clientId, id: { in: unpublished.map((b) => b.id) } },
            data: { status: "Published", publishedAt: now, updatedBy: user.id },
          });
        }
        const alreadyPublished = ids.filter((id) => !unpublished.find((b) => b.id === id));
        if (alreadyPublished.length > 0) {
          await prisma.wehowareBlog.updateMany({
            where: { clientId, id: { in: alreadyPublished } },
            data: { status: "Published", updatedBy: user.id },
          });
        }
        return NextResponse.json({ updated: ids.length, deleted: 0 });
      }

      const { count } = await prisma.wehowareBlog.updateMany({ where, data: updateData });
      return NextResponse.json({ updated: count, deleted: 0 });
    } catch (err) {
      console.error("[POST /api/v1/blogs/bulk] error:", err);
      return NextResponse.json({ error: "Bulk operation failed" }, { status: 500 });
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
