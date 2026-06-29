/**
 * /api/v1/inventory
 *
 * GET  — list inventory items (paginated, filtered) for the caller's active client
 * POST — create a new inventory item (employee/admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import { sanitizeHtml } from "@/lib/sanitize";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set(["created_at", "updated_at", "title", "price", "quantity", "status", "active", "featured"]);
const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  price: "price",
  quantity: "quantity",
  status: "status",
  active: "active",
  featured: "featured",
};

function serialize(item) {
  const price = item.price !== null && item.price !== undefined ? Number(item.price) : null;
  return {
    id: item.id,
    client_id: item.clientId,
    category_id: item.categoryId,
    title: item.title,
    slug: item.slug,
    type: item.type,
    sku: item.sku,
    description: item.description,
    content: item.content,
    thumbnail: item.thumbnail,
    thumbnail_alt: item.thumbnailAlt,
    price,
    currency: item.currency,
    price_visible: item.priceVisible,
    quantity: item.quantity,
    reorder_threshold: item.reorderThreshold,
    status: item.status,
    tags: item.tags,
    featured: item.featured,
    active: item.active,
    attributes: item.attributes,
    images: item.images,
    videos: item.videos,
    meta_title: item.metaTitle,
    meta_description: item.metaDescription,
    meta_keywords: item.metaKeywords,
    views: item.views,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    created_by: item.createdBy,
    updated_by: item.updatedBy,
    category: item.category
      ? { id: item.category.id, name: item.category.name, slug: item.category.slug }
      : null,
  };
}

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
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

  const fallback = base || "item";
  let candidate = fallback;
  for (let counter = 1; counter < 100; counter++) {
    const hit = await prisma.wehowareInventoryItem.findFirst({
      where: { clientId, slug: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${fallback}-${counter}`;
  }
  return `${fallback}-${Date.now()}`;
}

// -------------------------------------------------------------------
// GET /api/v1/inventory
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const url = new URL(request.url);
      const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Number.parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10))
      );
      const search = (url.searchParams.get("search") || "").trim();
      const categoryId = url.searchParams.get("categoryId") || "";
      const type = url.searchParams.get("type") || "";
      const status = url.searchParams.get("status") || "";
      const featured = url.searchParams.get("featured");
      const active = url.searchParams.get("active");
      const sortByRaw = url.searchParams.get("sortBy") || "created_at";
      const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
      const sortBy = SORTABLE_FIELDS.has(sortByRaw) ? FIELD_MAP[sortByRaw] : "createdAt";

      const where = { clientId };
      if (categoryId) where.categoryId = categoryId;
      if (type) where.type = type;
      if (status) where.status = status;
      if (featured === "true") where.featured = true;
      if (active === "true") where.active = true;
      if (active === "false") where.active = false;
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { sku: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [items, totalItems] = await Promise.all([
        prisma.wehowareInventoryItem.findMany({
          where,
          include: { category: { select: { id: true, name: true, slug: true } } },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareInventoryItem.count({ where }),
      ]);

      const [activeCount, lowStockRows, outOfStockCount, soldCount, totalValueRows] = await Promise.all([
        prisma.wehowareInventoryItem.count({ where: { clientId, active: true } }),
        prisma.$queryRaw`SELECT COUNT(*) AS cnt FROM wehoware_inventory_items WHERE client_id = ${clientId} AND active = 1 AND quantity <= reorder_threshold`,
        prisma.wehowareInventoryItem.count({ where: { clientId, active: true, quantity: 0 } }),
        prisma.wehowareInventoryItem.count({ where: { clientId, status: "sold" } }),
        prisma.$queryRaw`SELECT COALESCE(SUM(price), 0) AS total_value FROM wehoware_inventory_items WHERE client_id = ${clientId} AND active = 1`,
      ]);

      const stats = {
        total: totalItems,
        active: activeCount,
        lowStock: Number(lowStockRows[0]?.cnt ?? 0),
        outOfStock: outOfStockCount,
        sold: soldCount,
        totalValue: Number(totalValueRows[0]?.total_value ?? 0),
      };

      return NextResponse.json({
        data: items.map(serialize),
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
        stats,
      });
    } catch (err) {
      console.error("[GET /api/v1/inventory] error:", err);
      return NextResponse.json({ error: "Failed to fetch inventory items" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST /api/v1/inventory
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required to create an inventory item" },
          { status: 400 }
        );
      }
      const clientId = user.activeClientId;

      const body = await request.json();
      const {
        title, category_id: categoryId, type, sku,
        description, content,
        thumbnail, thumbnail_alt: thumbnailAlt,
        price, currency, price_visible: priceVisible,
        quantity, reorder_threshold: reorderThreshold,
        status, tags, featured, active,
        attributes, images, videos,
        meta_title: metaTitle, meta_description: metaDescription, meta_keywords: metaKeywords,
        slug: slugInput,
      } = body ?? {};

      if (!title) {
        return NextResponse.json({ error: "Missing required field: title" }, { status: 400 });
      }
      if (!categoryId) {
        return NextResponse.json({ error: "Missing required field: category_id" }, { status: 400 });
      }

      const slug = slugInput
        ? await generateUniqueSlug(prisma, slugInput, clientId)
        : await generateUniqueSlug(prisma, title, clientId);

      const item = await prisma.wehowareInventoryItem.create({
        data: {
          clientId,
          categoryId,
          title,
          slug,
          type: type || "product",
          sku: sku || null,
          description: description ? sanitizeHtml(description) : null,
          content: content ? sanitizeHtml(content) : null,
          thumbnail: thumbnail || null,
          thumbnailAlt: thumbnailAlt || null,
          price: price !== undefined && price !== null ? Number(price) : null,
          currency: currency || "CAD",
          priceVisible: priceVisible !== undefined ? Boolean(priceVisible) : true,
          quantity: quantity !== undefined ? Number(quantity) : 0,
          reorderThreshold: reorderThreshold !== undefined ? Number(reorderThreshold) : 0,
          status: status || "in_stock",
          tags: tags ?? [],
          featured: featured !== undefined ? Boolean(featured) : false,
          active: active !== undefined ? Boolean(active) : true,
          attributes: attributes ?? undefined,
          images: images ?? undefined,
          videos: videos ?? undefined,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          metaKeywords: metaKeywords || null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });

      return NextResponse.json({ item: serialize(item) }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/inventory] error:", err);
      if (err?.code === "P2003") return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
      if (err?.code === "P2002") return NextResponse.json({ error: "An item with this slug already exists" }, { status: 409 });
      if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
      return NextResponse.json({ error: "Failed to create inventory item" }, { status: 500 });
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
