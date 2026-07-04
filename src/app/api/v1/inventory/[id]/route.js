/**
 * /api/v1/inventory/[id]
 *
 * GET    — fetch a single inventory item
 * PUT    — update (employee/admin)
 * DELETE — delete (admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { sanitizeHtml } from "@/lib/sanitize";
import { computeSeoScore, normalizeTargetKeywords } from "@/lib/seoScore";

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

function canManageItems(user) {
  if (user.role === "client") {
    return ["client", "manager", "editor"].includes(user.activeClientRole);
  }
  return true;
}

async function loadItem(prisma, user, id) {
  const clientId = resolveClientId(user);
  if (!clientId) return { status: 400, body: { error: "Active client context required" } };
  const item = await prisma.wehowareInventoryItem.findFirst({
    where: { id, clientId },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!item) return { status: 404, body: { error: "Inventory item not found" } };
  return { status: 200, data: item };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const res = await loadItem(prisma, user, id);
    if (res.status !== 200) return NextResponse.json(res.body, { status: res.status });
    return NextResponse.json({ item: serialize(res.data) });
  } catch (err) {
    console.error("[GET /api/v1/inventory/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch inventory item" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;

    if (!canManageItems(user)) {
      return NextResponse.json({ error: "Forbidden - Requires owner, manager, or editor role" }, { status: 403 });
    }

    const { id } = await params;
    const auth = await loadItem(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });

    const body = await request.json();
    const data = { updatedBy: user.id };

    if (body.title !== undefined) data.title = body.title;
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.category_id !== undefined) data.categoryId = body.category_id;
    if (body.type !== undefined) data.type = body.type;
    if (body.sku !== undefined) data.sku = body.sku || null;
    if (body.description !== undefined) data.description = body.description ? sanitizeHtml(body.description) : null;
    if (body.content !== undefined) data.content = body.content ? sanitizeHtml(body.content) : null;
    if (body.thumbnail !== undefined) data.thumbnail = body.thumbnail || null;
    if (body.thumbnail_alt !== undefined) data.thumbnailAlt = body.thumbnail_alt || null;
    if (body.price !== undefined) data.price = body.price !== null ? Number(body.price) : null;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.price_visible !== undefined) data.priceVisible = Boolean(body.price_visible);
    if (body.quantity !== undefined) data.quantity = Number(body.quantity);
    if (body.reorder_threshold !== undefined) data.reorderThreshold = Number(body.reorder_threshold);
    if (body.status !== undefined) data.status = body.status;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.featured !== undefined) data.featured = Boolean(body.featured);
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.attributes !== undefined) data.attributes = body.attributes;
    if (body.images !== undefined) data.images = body.images;
    if (body.videos !== undefined) data.videos = body.videos;
    if (body.meta_title !== undefined) data.metaTitle = body.meta_title || null;
    if (body.meta_description !== undefined) data.metaDescription = body.meta_description || null;
    if (body.meta_keywords !== undefined) data.metaKeywords = body.meta_keywords || null;
    if (body.open_graph_title !== undefined) data.openGraphTitle = body.open_graph_title || null;
    if (body.open_graph_description !== undefined) data.openGraphDescription = body.open_graph_description || null;
    if (body.open_graph_image !== undefined) data.openGraphImage = body.open_graph_image || null;
    if (body.twitter_title !== undefined) data.twitterTitle = body.twitter_title || null;
    if (body.twitter_description !== undefined) data.twitterDescription = body.twitter_description || null;
    if (body.twitter_image !== undefined) data.twitterImage = body.twitter_image || null;
    if (body.canonical_url !== undefined) data.canonicalUrl = body.canonical_url || null;
    if (body.robots_meta !== undefined) data.robotsMeta = body.robots_meta || "index,follow";
    if (body.schema_type !== undefined) data.schemaType = body.schema_type || "Product";
    if (body.cta_heading !== undefined) data.ctaHeading = body.cta_heading || null;
    if (body.cta_body !== undefined) data.ctaBody = body.cta_body || null;
    if (body.cta_button_text !== undefined) data.ctaButtonText = body.cta_button_text || null;
    if (body.cta_button_url !== undefined) data.ctaButtonUrl = body.cta_button_url || null;
    if (body.allow_social_share !== undefined) data.allowSocialShare = Boolean(body.allow_social_share);
    if (body.updated_at !== undefined) delete data.updated_at;

    // Recompute SEO score if any SEO-related field changed
    const seoRelevantFields = [
      "meta_title", "meta_description", "meta_keywords", "thumbnail", "thumbnail_alt",
      "open_graph_title", "open_graph_description", "open_graph_image", "slug", "content", "description", "target_keywords",
    ];
    const shouldRecomputeSeo = seoRelevantFields.some((f) => body[f] !== undefined);
    if (shouldRecomputeSeo) {
      const existing = await prisma.wehowareInventoryItem.findUnique({
        where: { id },
        select: {
          metaTitle: true, metaDescription: true, metaKeywords: true,
          thumbnail: true, thumbnailAlt: true, slug: true,
          content: true, description: true, targetKeywords: true,
          openGraphTitle: true, openGraphDescription: true, openGraphImage: true,
        },
      });
      const merged = { ...existing, ...data };
      const normalizedKeywords = body.target_keywords !== undefined
        ? normalizeTargetKeywords(body.target_keywords)
        : (merged.targetKeywords ?? []);
      data.seoScore = computeSeoScore({
        metaTitle: merged.metaTitle,
        metaDescription: merged.metaDescription,
        metaKeywords: merged.metaKeywords,
        thumbnail: merged.thumbnail,
        thumbnailAlt: merged.thumbnailAlt,
        openGraphTitle: merged.openGraphTitle,
        openGraphDescription: merged.openGraphDescription,
        openGraphImage: merged.openGraphImage,
        slug: merged.slug,
        content: merged.content ?? merged.description,
        targetKeywords: normalizedKeywords,
      });
      if (body.target_keywords !== undefined) data.targetKeywords = normalizedKeywords;
    }

    // Auto-generate canonical URL from client domain + slug if not explicitly provided
    if (body.canonical_url === undefined || body.canonical_url === null || body.canonical_url === "") {
      const clientId = resolveClientId(user);
      const client = await prisma.wehowareClient.findUnique({
        where: { id: clientId },
        select: { domain: true },
      });
      if (client?.domain) {
        const effectiveSlug = data.slug || auth.data.slug;
        data.canonicalUrl = `https://${client.domain}/inventory/${effectiveSlug}`;
      }
    }

    const updated = await prisma.wehowareInventoryItem.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return NextResponse.json({ item: serialize(updated) });
  } catch (err) {
    console.error("[PUT /api/v1/inventory/[id]]", err);
    if (err?.code === "P2003") return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
    if (err?.code === "P2002") return NextResponse.json({ error: "An item with this slug already exists" }, { status: 409 });
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    return NextResponse.json({ error: "Failed to update inventory item", detail: err?.message || String(err), code: err?.code || null }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;

    if (!canManageItems(user)) {
      return NextResponse.json({ error: "Forbidden - Requires owner, manager, or editor role" }, { status: 403 });
    }

    const { id } = await params;
    const auth = await loadItem(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });
    await prisma.wehowareInventoryItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v1/inventory/[id]]", err);
    return NextResponse.json({ error: "Failed to delete inventory item" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });
