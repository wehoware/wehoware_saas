/**
 * /api/v1/services
 *
 * GET  — list services (paginated, filtered) for the caller's active client
 * POST — create a new service (employee/admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import { sanitizeHtml } from "@/lib/sanitize";
import { computeSeoScore, normalizeTargetKeywords } from "@/lib/seoScore";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set(["created_at", "updated_at", "title", "fee", "price", "active", "featured", "views", "rating"]);
const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  fee: "fee",
  price: "fee",
  active: "active",
  featured: "featured",
  views: "views",
  rating: "rating",
};

function serialize(s) {
  const fee = s.fee !== null && s.fee !== undefined ? Number(s.fee) : null;
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
    fee,
    fee_currency: s.feeCurrency,
    fee_label: fee === null || fee === 0 ? "Free" : null,
    service_code: s.serviceCode,
    duration: s.duration,
    tags: s.tags,
    active: s.active,
    featured: s.featured,
    rating: s.rating ? Number(s.rating) : 0,
    reviews_count: s.reviewsCount,
    views: s.views,
    scheduled_publish_at: s.scheduledPublishAt,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    created_by: s.createdBy,
    updated_by: s.updatedBy,
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

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

// Slug uniqueness is scoped per-client so the same slug can exist for different clients.
async function generateUniqueSlug(prisma, title, clientId, currentSlug = null) {
  const base = String(title)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base && base === currentSlug) return base;

  const fallback = base || "service";
  let candidate = fallback;
  for (let counter = 1; counter < 100; counter++) {
    const hit = await prisma.wehowareService.findFirst({
      where: { clientId, slug: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${fallback}-${counter}`;
  }
  return `${fallback}-${Date.now()}`;
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
      const featured = url.searchParams.get("featured");
      const active = url.searchParams.get("active");
      const sortByRaw = url.searchParams.get("sortBy") || "created_at";
      const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
      const sortBy = SORTABLE_FIELDS.has(sortByRaw) ? FIELD_MAP[sortByRaw] : "createdAt";

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
          include: { category: { select: { id: true, name: true, slug: true } } },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareService.count({ where }),
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
      console.error("[GET /api/v1/services] error:", err);
      return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// Shared helpers for POST / PUT
// -------------------------------------------------------------------

function parseFee(fee, price) {
  const raw = fee !== undefined ? fee : price;
  return raw !== undefined && raw !== null ? Number(raw) : undefined;
}

function validateServiceCreate(title, categoryId, feeValue) {
  if (!title) return "Missing required field: title";
  if (!categoryId) return "Missing required field: category_id";
  if (feeValue === undefined) return "Missing required field: price";
  return Number.isFinite(feeValue) ? null : "price must be a valid number";
}

function handleServicePrismaError(err, label) {
  console.error(label, err);
  if (err?.code === "P2003") return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
  if (err?.code === "P2002") return NextResponse.json({ error: "A service with this slug already exists" }, { status: 409 });
  if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  return NextResponse.json({ error: "Failed to save service" }, { status: 500 });
}

// -------------------------------------------------------------------
// POST /api/v1/services
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required to create a service" },
          { status: 400 }
        );
      }
      const clientId = user.activeClientId;

      const body = await request.json();
      const {
        title, description, content,
        category_id: categoryId,
        price, fee, currency, fee_currency: feeCurrencyInput,
        duration, active, featured,
        image_url: imageUrl, thumbnail,
        thumbnail_alt: thumbnailAltInput,
        service_code: serviceCode, tags,
        scheduled_publish_at: scheduledPublishAtInput,
        meta_title: metaTitle, meta_description: metaDescription, meta_keywords: metaKeywords,
        open_graph_title: openGraphTitle,
        open_graph_description: openGraphDescription,
        open_graph_image: openGraphImage,
        twitter_title: twitterTitle,
        twitter_description: twitterDescription,
        twitter_image: twitterImage,
        canonical_url: canonicalUrl,
        robots_meta: robotsMeta,
        schema_type: schemaType,
        target_keywords: targetKeywords,
        cta_heading: ctaHeading,
        cta_body: ctaBody,
        cta_button_text: ctaButtonText,
        cta_button_url: ctaButtonUrl,
        allow_social_share: allowSocialShare,
      } = body ?? {};

      const feeValue = parseFee(fee, price);
      const validationError = validateServiceCreate(title, categoryId, feeValue);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const slug = await generateUniqueSlug(prisma, title, clientId);

      const normalizedKeywords = normalizeTargetKeywords(targetKeywords);
      const seoScoreValue = computeSeoScore({
        metaTitle: metaTitle ?? title,
        metaDescription: metaDescription ?? description,
        metaKeywords: metaKeywords,
        thumbnail: thumbnail ?? imageUrl,
        thumbnailAlt: thumbnailAltInput,
        openGraphTitle: openGraphTitle,
        openGraphDescription: openGraphDescription,
        openGraphImage: openGraphImage,
        slug,
        content: content ?? description,
        targetKeywords: normalizedKeywords,
      });

      const service = await prisma.wehowareService.create({
        data: {
          clientId, title, slug,
          description: description ? sanitizeHtml(description) : null,
          content: content ? sanitizeHtml(content) : null,
          thumbnail: thumbnail ?? imageUrl ?? null,
          thumbnailAlt: thumbnailAltInput ?? null,
          categoryId, fee: feeValue,
          feeCurrency: feeCurrencyInput ?? currency ?? "CAD",
          serviceCode: serviceCode ?? null,
          duration: duration ?? null,
          scheduledPublishAt: scheduledPublishAtInput ? new Date(scheduledPublishAtInput) : null,
          active: active === undefined ? true : Boolean(active),
          featured: featured === undefined ? false : Boolean(featured),
          tags: tags ?? [],
          metaTitle: metaTitle ?? null,
          metaDescription: metaDescription ?? null,
          metaKeywords: metaKeywords ?? null,
          openGraphTitle: openGraphTitle ?? null,
          openGraphDescription: openGraphDescription ?? null,
          openGraphImage: openGraphImage ?? null,
          twitterTitle: twitterTitle ?? null,
          twitterDescription: twitterDescription ?? null,
          twitterImage: twitterImage ?? null,
          canonicalUrl: canonicalUrl ?? null,
          robotsMeta: robotsMeta ?? "index,follow",
          schemaType: schemaType ?? "Service",
          seoScore: seoScoreValue,
          targetKeywords: normalizedKeywords,
          ctaHeading: ctaHeading ?? null,
          ctaBody: ctaBody ?? null,
          ctaButtonText: ctaButtonText ?? null,
          ctaButtonUrl: ctaButtonUrl ?? null,
          allowSocialShare: allowSocialShare === undefined ? true : Boolean(allowSocialShare),
          createdBy: user.id, updatedBy: user.id,
        },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });

      return NextResponse.json({ service: serialize(service) }, { status: 201 });
    } catch (err) {
      return handleServicePrismaError(err, "[POST /api/v1/services] error:");
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
