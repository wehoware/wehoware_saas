/**
 * /api/v1/seo/static-pages
 *
 * Prisma/MySQL-backed replacement for the old Supabase handler.
 *
 * GET  — list static pages (paginated + filtered) for the caller's client
 * POST — create a new static page
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const SORTABLE_FIELDS = new Set([
  "page_slug",
  "title",
  "created_at",
  "updated_at",
  "is_active",
]);
const FIELD_MAP = {
  page_slug: "pageSlug",
  title: "title",
  created_at: "createdAt",
  updated_at: "updatedAt",
  is_active: "isActive",
};

function serialize(p) {
  return {
    id: p.id,
    client_id: p.clientId,
    page_slug: p.pageSlug,
    title: p.title,
    content: p.content,
    template_name: p.templateName,
    layout: p.layout,
    meta_title: p.metaTitle,
    meta_description: p.metaDescription,
    meta_keywords: p.metaKeywords,
    open_graph_title: p.openGraphTitle,
    open_graph_description: p.openGraphDescription,
    open_graph_image: p.openGraphImage,
    is_active: p.isActive,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required for employee/admin." },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const slug = url.searchParams.get("slug");
      const isActiveRaw = url.searchParams.get("is_active");
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
      const sortByRaw = url.searchParams.get("sortBy") || "page_slug";
      const sortOrder =
        url.searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
      const sortBy = SORTABLE_FIELDS.has(sortByRaw)
        ? FIELD_MAP[sortByRaw]
        : "pageSlug";

      const where = { clientId };
      if (slug) where.pageSlug = slug;
      if (isActiveRaw === "true") where.isActive = true;
      else if (isActiveRaw === "false") where.isActive = false;

      const [items, totalItems] = await Promise.all([
        prisma.wehowareStaticPage.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareStaticPage.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serialize),
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/seo/static-pages] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const body = await request.json();

      if (!body?.page_slug) {
        return NextResponse.json(
          { error: "Page slug (page_slug) is required." },
          { status: 400 }
        );
      }

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required for employee/admin." },
          { status: 400 }
        );
      }

      const duplicate = await prisma.wehowareStaticPage.findFirst({
        where: { clientId, pageSlug: body.page_slug },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            error: `Conflict: A page with slug "${body.page_slug}" already exists for this client.`,
          },
          { status: 409 }
        );
      }

      const created = await prisma.wehowareStaticPage.create({
        data: {
          clientId,
          pageSlug: body.page_slug,
          title: body.title ?? "",
          content: body.content ?? "",
          templateName: body.template_name ?? null,
          layout: body.layout ?? null,
          metaTitle: body.meta_title ?? "",
          metaDescription: body.meta_description ?? "",
          metaKeywords: body.meta_keywords ?? "",
          openGraphTitle: body.open_graph_title ?? "",
          openGraphDescription: body.open_graph_description ?? "",
          openGraphImage: body.open_graph_image ?? "",
          isActive: body.is_active !== undefined ? Boolean(body.is_active) : true,
        },
      });

      return NextResponse.json({ data: serialize(created) }, { status: 201 });
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A page with this slug already exists for this client." },
          { status: 409 }
        );
      }
      console.error("[POST /api/v1/seo/static-pages] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
