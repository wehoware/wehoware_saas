/**
 * /api/v1/notifications
 *
 * GET  — list notifications for the current user (filterable by read/unread)
 * PUT  — mark notifications as read (single, all, or all unread)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId;
  return user.activeClientId ?? null;
}

// -------------------------------------------------------------------
// GET /api/v1/notifications
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "No client context resolved." },
          { status: 400 }
        );
      }

      const filter = searchParams.get("filter"); // "unread" | "read" | null
      const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
      );

      const where = { clientId, userId: user.id };
      if (filter === "unread") where.read = false;
      if (filter === "read") where.read = true;

      const [items, unreadCount] = await Promise.all([
        prisma.wehowareNotification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
        prisma.wehowareNotification.count({
          where: { clientId, userId: user.id, read: false },
        }),
      ]);

      const serialized = items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        metadata: n.metadata,
        read: n.read,
        read_at: n.readAt?.toISOString() ?? null,
        created_at: n.createdAt.toISOString(),
      }));

      return NextResponse.json({
        notifications: serialized,
        unread_count: unreadCount,
        total: items.length,
      });
    } catch (err) {
      console.error("[GET /api/v1/notifications] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT /api/v1/notifications  — mark as read
// Body: { id: "uuid" }  → mark single notification as read
// Body: { all: true }   → mark all unread as read
// -------------------------------------------------------------------
export const PUT = withAuth(
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

      const now = new Date();

      if (body.all) {
        // Mark all unread as read
        const result = await prisma.wehowareNotification.updateMany({
          where: { clientId, userId: user.id, read: false },
          data: { read: true, readAt: now },
        });
        return NextResponse.json({
          success: true,
          marked_read: result.count,
        });
      }

      if (body.id) {
        // Mark single notification as read
        const updated = await prisma.wehowareNotification.updateMany({
          where: { id: body.id, clientId, userId: user.id, read: false },
          data: { read: true, readAt: now },
        });
        if (updated.count === 0) {
          return NextResponse.json(
            { error: "Notification not found or already read" },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true });
      }

      return NextResponse.json(
        { error: "Provide 'id' or 'all' in the request body" },
        { status: 400 }
      );
    } catch (err) {
      console.error("[PUT /api/v1/notifications] error:", err);
      return NextResponse.json(
        { error: "Failed to update notification" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
