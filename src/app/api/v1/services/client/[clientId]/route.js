/**
 * /api/v1/services/client/[clientId]
 *
 * List services for a specific client (employee/admin only).
 * Paginated + filterable.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  fee: "fee",
  price: "fee",
  active: "active",
  featured: "featured",
};

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma } = request;
      const { clientId } = await params;

      const url = new URL(request.url);
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
      const search = (url.searchParams.get("search") || "").trim();
      const categoryId = url.searchParams.get("categoryId") || "";
      const featured = url.searchParams.get("featured");
      const active = url.searchParams.get("active");
      const sortByRaw = url.searchParams.get("sortBy") || "created_at";
      const sortOrder =
        url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
      const sortBy = FIELD_MAP[sortByRaw] ?? "createdAt";

      const where = { clientId };
      if (categoryId) where.categoryId = categoryId;
      if (featured === "true") where.featured = true;
      if (active === "true") where.active = true;
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [items, totalItems] = await Promise.all([
        prisma.wehowareService.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareService.count({ where }),
      ]);

      const data = items.map((s) => ({
        ...s,
        wehoware_service_categories: s.category
          ? {
              id: s.category.id,
              name: s.category.name,
              slug: s.category.slug,
            }
          : null,
      }));

      return NextResponse.json({
        data,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error(
        "[GET /api/v1/services/client/[clientId]] error:",
        err
      );
      return NextResponse.json(
        { error: "Failed to fetch services for the specified client" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
