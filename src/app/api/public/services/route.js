/**
 * /api/public/services
 *
 * Public API endpoint for fetching services without authentication.
 * Scoped to a specific client via domain or clientId query parameter.
 * Only returns active services.
 *
 * Usage:
 *   GET /api/public/services?domain=hadi-consultant.vercel.app
 *   GET /api/public/services?clientId=uuid-here
 *   GET /api/public/services?domain=hadi-consultant.vercel.app&featured=true&category=uuid
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveClient, buildItemListSchema, buildCollectionPageSchema } from "@/lib/public-seo";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "title",
  "fee",
  "featured",
]);

const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  fee: "fee",
  featured: "featured",
};

function serialize(s) {
  return {
    id: s.id,
    client_id: s.clientId,
    category_id: s.categoryId,
    title: s.title,
    slug: s.slug,
    description: s.description,
    content: s.content,
    thumbnail: s.thumbnail,
    thumbnail_alt: s.thumbnailAlt,
    fee: s.fee ? Number(s.fee) : null,
    fee_currency: s.feeCurrency,
    fee_label: !s.fee || Number(s.fee) === 0 ? "Free" : null,
    service_code: s.serviceCode,
    duration: s.duration,
    tags: s.tags,
    active: s.active,
    featured: s.featured,
    rating: s.rating ? Number(s.rating) : 0,
    reviews_count: s.reviewsCount,
    views: s.views,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    meta_title: s.metaTitle,
    meta_description: s.metaDescription,
    meta_keywords: s.metaKeywords,
    open_graph_title: s.openGraphTitle,
    open_graph_description: s.openGraphDescription,
    open_graph_image: s.openGraphImage,
    twitter_title: s.twitterTitle,
    twitter_description: s.twitterDescription,
    twitter_image: s.twitterImage,
    canonical_url: s.canonicalUrl,
    robots_meta: s.robotsMeta,
    schema_type: s.schemaType,
    seo_score: s.seoScore,
    target_keywords: s.targetKeywords,
    cta_heading: s.ctaHeading,
    cta_body: s.ctaBody,
    cta_button_text: s.ctaButtonText,
    cta_button_url: s.ctaButtonUrl,
    allow_social_share: s.allowSocialShare,
    wehoware_service_categories: s.category
      ? { id: s.category.id, name: s.category.name, slug: s.category.slug }
      : null,
  };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain")?.trim();
    const clientId = url.searchParams.get("clientId")?.trim();

    const client = await resolveClient(domain, clientId);

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (client.inactive) {
      return NextResponse.json(
        { error: "Client is inactive" },
        { status: 403 }
      );
    }

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
    const sortByRaw = url.searchParams.get("sortBy") || "created_at";
    const sortOrder =
      url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const sortBy = SORTABLE_FIELDS.has(sortByRaw)
      ? FIELD_MAP[sortByRaw]
      : "createdAt";

    const where = { clientId: client.id, active: true };
    if (categoryId) where.categoryId = categoryId;
    if (featured === "true") where.featured = true;
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

    const data = items.map(serialize);
    const baseUrl = client.domain ? `https://${client.domain}/services` : `/api/public/services`;

    return NextResponse.json({
      data,
      pagination: {
        totalItems,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
      schema: {
        item_list: buildItemListSchema(data, baseUrl),
        collection_page: buildCollectionPageSchema(
          "Services",
          client.companyName ? `${client.companyName} services` : "Services",
          client.domain ? `https://${client.domain}/services` : undefined
        ),
      },
    });
  } catch (err) {
    console.error("[GET /api/public/services] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
