/**
 * /api/v1/blogs/client/[clientId]
 *
 * List blogs for a specific client. Authorization is strict:
 *   - role=client     → must match their own clientId
 *   - role=employee   → must match their active client context
 *   - role=admin      → must match their active client context
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  published_at: "publishedAt",
  title: "title",
  status: "status",
};

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { clientId } = await params;

      // Authorization
      if (user.role === "client" && String(user.clientId) !== String(clientId)) {
        return NextResponse.json(
          { error: "Clients can only view their own blogs" },
          { status: 403 }
        );
      }
      if (["employee", "admin"].includes(user.role)) {
        if (!user.activeClientId) {
          return NextResponse.json(
            { error: "No active client context set" },
            { status: 403 }
          );
        }
        if (String(user.activeClientId) !== String(clientId)) {
          return NextResponse.json(
            { error: "Can only view blogs for the active client context" },
            { status: 403 }
          );
        }
      }

      const url = new URL(request.url);
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10))
      );
      const search = (url.searchParams.get("search") || "").trim();
      const category = url.searchParams.get("category") || "";
      const status = url.searchParams.get("status") || "";
      const sortByRaw = url.searchParams.get("sortBy") || "created_at";
      const sortOrder =
        url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
      const sortBy = FIELD_MAP[sortByRaw] ?? "createdAt";

      const where = { clientId };
      if (category) where.categoryId = category;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { content: { contains: search } },
        ];
      }

      const [items, totalItems] = await Promise.all([
        prisma.wehowareBlog.findMany({
          where,
          include: {
            category: { select: { id: true, name: true } },
            creator: { select: { firstName: true, lastName: true } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareBlog.count({ where }),
      ]);

      const blogs = items.map((b) => ({
        ...b,
        wehoware_blog_categories: b.category ? { name: b.category.name } : null,
        wehoware_profiles: b.creator
          ? {
              first_name: b.creator.firstName,
              last_name: b.creator.lastName,
            }
          : null,
      }));

      return NextResponse.json({
        blogs,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
        client_id: clientId,
      });
    } catch (err) {
      console.error("[GET /api/v1/blogs/client/[clientId]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch blogs" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
