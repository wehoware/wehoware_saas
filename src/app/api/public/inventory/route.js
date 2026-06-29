/**
 * /api/public/inventory
 *
 * Public API endpoint for fetching active inventory items without authentication.
 * Scoped to a specific client via domain or clientId query parameter.
 * Only returns active items with active status.
 *
 * Usage:
 *   GET /api/public/inventory?domain=nawab-motors.com
 *   GET /api/public/inventory?clientId=uuid-here
 *   GET /api/public/inventory?domain=nawab-motors.com&featured=true&category=uuid&type=vehicle
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set(["created_at", "updated_at", "title", "price", "featured"]);
const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  price: "price",
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
    thumbnail: item.thumbnail,
    thumbnail_alt: item.thumbnailAlt,
    price,
    currency: item.currency,
    price_visible: item.priceVisible,
    price_label: !item.priceVisible ? "Contact for pricing" : (!price || price === 0 ? "Free" : null),
    quantity: item.quantity,
    status: item.status,
    tags: item.tags,
    featured: item.featured,
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
    category: item.category
      ? { id: item.category.id, name: item.category.name, slug: item.category.slug }
      : null,
  };
}

async function resolveClient(domain, clientId) {
  if (!domain && !clientId) return null;
  const where = {};
  if (domain) where.domain = domain;
  if (clientId) where.id = clientId;
  const client = await prisma.wehowareClient.findFirst({
    where,
    select: { id: true, active: true },
  });
  if (!client) return null;
  if (!client.active) return { inactive: true, id: client.id };
  return client;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain")?.trim();
    const clientId = url.searchParams.get("clientId")?.trim();

    const client = await resolveClient(domain, clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (client.inactive) {
      return NextResponse.json({ error: "Client is inactive" }, { status: 403 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10))
    );
    const search = (url.searchParams.get("search") || "").trim();
    const categoryId = url.searchParams.get("categoryId") || "";
    const type = url.searchParams.get("type") || "";
    const featured = url.searchParams.get("featured");
    const sortByRaw = url.searchParams.get("sortBy") || "created_at";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const sortBy = SORTABLE_FIELDS.has(sortByRaw) ? FIELD_MAP[sortByRaw] : "createdAt";

    const where = { clientId: client.id, active: true, status: { in: ["active", "in_stock", "low_stock"] } };
    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;
    if (featured === "true") where.featured = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      prisma.wehowareInventoryItem.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareInventoryItem.count({ where }),
    ]);

    return NextResponse.json({
      data: items.map(serialize),
      pagination: {
        totalItems,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    console.error("[GET /api/public/inventory] error:", err);
    return NextResponse.json({ error: "Failed to fetch inventory items" }, { status: 500 });
  }
}
