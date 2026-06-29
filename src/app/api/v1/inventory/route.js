/**
 * /api/v1/inventory
 *
 * GET  — list inventory items (paginated, filtered) for the caller's active client
 * POST — create a new inventory item (employee/admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import { sanitizeHtml } from "@/lib/sanitize";
import { computeSeoScore, normalizeTargetKeywords } from "@/lib/seoScore";

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
    open_graph_title: item.openGraphTitle,
    open_graph_description: item.openGraphDescription,
    open_graph_image: item.openGraphImage,
    twitter_title: item.twitterTitle,
    twitter_description: item.twitterDescription,
    twitter_image: item.twitterImage,
    canonical_url: item.canonicalUrl,
    robots_meta: item.robotsMeta,
    schema_type: item.schemaType,
    seo_score: item.seoScore,
    target_keywords: item.targetKeywords,
    cta_heading: item.ctaHeading,
    cta_body: item.ctaBody,
    cta_button_text: item.ctaButtonText,
    cta_button_url: item.ctaButtonUrl,
    allow_social_share: item.allowSocialShare,
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
        open_graph_title: openGraphTitle, open_graph_description: openGraphDescription, open_graph_image: openGraphImage,
        twitter_title: twitterTitle, twitter_description: twitterDescription, twitter_image: twitterImage,
        canonical_url: canonicalUrl, robots_meta: robotsMeta, schema_type: schemaType,
        target_keywords: targetKeywords,
        cta_heading: ctaHeading, cta_body: ctaBody, cta_button_text: ctaButtonText, cta_button_url: ctaButtonUrl,
        allow_social_share: allowSocialShare,
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

      // Auto-generate canonical URL from client domain + slug if not explicitly provided
      let resolvedCanonicalUrl = canonicalUrl ?? null;
      if (!resolvedCanonicalUrl) {
        const client = await prisma.wehowareClient.findUnique({
          where: { id: clientId },
          select: { domain: true },
        });
        if (client?.domain) {
          resolvedCanonicalUrl = `https://${client.domain}/inventory/${slug}`;
        }
      }

      const sanitizedContent = content ? sanitizeHtml(content) : null;
      const sanitizedDescription = description ? sanitizeHtml(description) : null;
      const normalizedKeywords = normalizeTargetKeywords(targetKeywords);
      const seoScoreValue = computeSeoScore({
        metaTitle: metaTitle ?? title,
        metaDescription: metaDescription ?? sanitizedDescription,
        metaKeywords: metaKeywords,
        thumbnail: thumbnail,
        thumbnailAlt: thumbnailAlt,
        openGraphTitle: openGraphTitle,
        openGraphDescription: openGraphDescription,
        openGraphImage: openGraphImage,
        slug,
        content: sanitizedContent ?? sanitizedDescription,
        targetKeywords: normalizedKeywords,
      });

      const item = await prisma.wehowareInventoryItem.create({
        data: {
          clientId,
          categoryId,
          title,
          slug,
          type: type || "product",
          sku: sku || null,
          description: sanitizedDescription,
          content: sanitizedContent,
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
          openGraphTitle: openGraphTitle || null,
          openGraphDescription: openGraphDescription || null,
          openGraphImage: openGraphImage || null,
          twitterTitle: twitterTitle || null,
          twitterDescription: twitterDescription || null,
          twitterImage: twitterImage || null,
          canonicalUrl: resolvedCanonicalUrl,
          robotsMeta: robotsMeta || "index,follow",
          schemaType: schemaType || "Product",
          seoScore: seoScoreValue,
          targetKeywords: normalizedKeywords,
          ctaHeading: ctaHeading || null,
          ctaBody: ctaBody || null,
          ctaButtonText: ctaButtonText || null,
          ctaButtonUrl: ctaButtonUrl || null,
          allowSocialShare: allowSocialShare === undefined ? true : Boolean(allowSocialShare),
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
