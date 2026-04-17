/**
 * /api/v1/blogs
 *
 * Prisma/MySQL-backed replacement for the old Supabase handler.
 *
 * GET   — list blogs (paginated, filtered) for the caller's active client
 * POST  — create a new blog
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "published_at",
  "title",
  "status",
]);
// Map snake_case query values → camelCase Prisma field names
const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  published_at: "publishedAt",
  title: "title",
  status: "status",
};

/**
 * Resolve which client context (tenant) applies for the current request.
 * Returns null if the user has no valid context.
 */
function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

async function generateUniqueSlug(prisma, title, clientId, currentSlug = null) {
  const base = String(title)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base && base === currentSlug) return base;

  let candidate = base || "post";
  let counter = 1;
  // Bounded loop guard — stop after 100 attempts to avoid runaway
  while (counter < 100) {
    const hit = await prisma.wehowareBlog.findFirst({
      where: { clientId, slug: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${base || "post"}-${counter}`;
    counter += 1;
  }
  // Fallback — add a random suffix
  return `${base || "post"}-${Date.now()}`;
}

// -------------------------------------------------------------------
// GET /api/v1/blogs
// -------------------------------------------------------------------
export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) {
      return NextResponse.json(
        { error: "Active client context required" },
        { status: 400 }
      );
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
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const sortBy = SORTABLE_FIELDS.has(sortByRaw)
      ? FIELD_MAP[sortByRaw]
      : "createdAt";

    const where = { clientId };
    if (category) where.categoryId = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { excerpt: { contains: search } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      prisma.wehowareBlog.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareBlog.count({ where }),
    ]);

    // Preserve the old response shape used by admin/blogs/page.js etc.
    const blogs = items.map((b) => ({
      ...b,
      wehoware_blog_categories: b.category ? { name: b.category.name } : null,
    }));

    return NextResponse.json({
      blogs,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/blogs] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch blogs" },
      { status: 500 }
    );
  }
});

// -------------------------------------------------------------------
// POST /api/v1/blogs
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const {
        title,
        content,
        category_id: categoryId,
        status,
        thumbnail,
        excerpt,
      } = body ?? {};

      if (!title || !content || !categoryId) {
        return NextResponse.json(
          { error: "Title, content, and category are required" },
          { status: 400 }
        );
      }

      const slug = await generateUniqueSlug(prisma, title, clientId);

      const blog = await prisma.wehowareBlog.create({
        data: {
          title,
          slug,
          content,
          excerpt: excerpt ?? null,
          categoryId,
          status: status || "Draft",
          thumbnail: thumbnail ?? null,
          clientId,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ blog }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/blogs] error:", err);
      // Prisma known-error codes → friendlier messages
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid category_id" },
          { status: 400 }
        );
      }
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A blog with this slug already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create blog" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
