/**
 * /api/v1/services
 *
 * Prisma/MySQL-backed replacement for the old Supabase handler.
 *
 * GET  — list services (paginated, filtered) for the caller's active client
 * POST — create a new service (employee/admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "title",
  "fee",
  "price",
  "active",
  "featured",
]);
// Map snake_case query values → camelCase Prisma field names
const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  fee: "fee",
  price: "fee", // legacy alias — price maps to fee
  active: "active",
  featured: "featured",
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

async function generateUniqueSlug(prisma, title, currentSlug = null) {
  const base = String(title)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base && base === currentSlug) return base;

  let candidate = base || "service";
  let counter = 1;
  // Bounded loop guard — stop after 100 attempts to avoid runaway
  while (counter < 100) {
    const hit = await prisma.wehowareService.findFirst({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${base || "service"}-${counter}`;
    counter += 1;
  }
  // Fallback — add a timestamp suffix
  return `${base || "service"}-${Date.now()}`;
}

// -------------------------------------------------------------------
// GET /api/v1/services
// -------------------------------------------------------------------
export const GET = withAuth(
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
      const sortBy = SORTABLE_FIELDS.has(sortByRaw)
        ? FIELD_MAP[sortByRaw]
        : "createdAt";

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

      // Preserve the old response shape for the admin UI
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
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/services] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch services" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST /api/v1/services
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      // Only employee/admin can create; they must have active client context
      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required to create a service" },
          { status: 400 }
        );
      }
      const clientId = user.activeClientId;

      const body = await request.json();
      const {
        title,
        description,
        content,
        category_id: categoryId,
        price,
        fee,
        currency,
        fee_currency: feeCurrencyInput,
        duration,
        active,
        featured,
        image_url: imageUrl,
        thumbnail,
        service_code: serviceCode,
        tags,
        meta_title: metaTitle,
        meta_description: metaDescription,
        meta_keywords: metaKeywords,
      } = body ?? {};

      const feeValue = fee !== undefined ? fee : price;

      if (!title || !categoryId || feeValue === undefined || feeValue === null) {
        return NextResponse.json(
          { error: "Missing required fields: title, category_id, price" },
          { status: 400 }
        );
      }

      const slug = await generateUniqueSlug(prisma, title);

      const service = await prisma.wehowareService.create({
        data: {
          clientId,
          title,
          slug,
          description: description ?? null,
          content: content ?? null,
          thumbnail: thumbnail ?? imageUrl ?? null,
          categoryId,
          fee: feeValue,
          feeCurrency: feeCurrencyInput ?? currency ?? "CAD",
          serviceCode: serviceCode ?? null,
          duration: duration ?? null,
          active: active === undefined ? true : Boolean(active),
          featured: featured === undefined ? false : Boolean(featured),
          tags: tags ?? [],
          metaTitle: metaTitle ?? null,
          metaDescription: metaDescription ?? null,
          metaKeywords: metaKeywords ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });

      const response = {
        ...service,
        wehoware_service_categories: service.category
          ? {
              id: service.category.id,
              name: service.category.name,
              slug: service.category.slug,
            }
          : null,
      };

      return NextResponse.json({ service: response }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/services] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid category_id" },
          { status: 400 }
        );
      }
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A service with this slug already exists" },
          { status: 409 }
        );
      }
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON format in request body" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create service" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
