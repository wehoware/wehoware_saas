/**
 * /api/v1/services/[id]
 *
 * Prisma/MySQL-backed handlers for a single service.
 * GET    — fetch
 * PUT    — update (employee/admin)
 * DELETE — delete (admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { deleteThumbnailByUrl } from "@/lib/storage";
import { sanitizeHtml } from "@/lib/sanitize";
import { computeSeoScore, normalizeTargetKeywords } from "@/lib/seoScore";

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

  let candidate = base || "service";
  let counter = 1;
  while (counter < 100) {
    const notCurrent = currentSlug ? { NOT: { slug: currentSlug } } : {};
    const hit = await prisma.wehowareService.findFirst({
      where: { clientId, slug: candidate, ...notCurrent },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${base || "service"}-${counter}`;
    counter += 1;
  }
  return `${base || "service"}-${Date.now()}`;
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const service = await prisma.wehowareService.findFirst({
        where: { id, clientId },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });

      if (!service) {
        return NextResponse.json(
          {
            error:
              "Service not found or not accessible within your current context",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ service: serialize(service) });
    } catch (err) {
      console.error("[GET /api/v1/services/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch service" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: serviceId } = await params;

      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required to update a service" },
          { status: 400 }
        );
      }
      const activeClientId = user.activeClientId;

      const body = await request.json();

      // Fetch existing for ownership + slug diffing
      const existing = await prisma.wehowareService.findUnique({
        where: { id: serviceId },
        select: { id: true, clientId: true, title: true, slug: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      if (String(existing.clientId) !== String(activeClientId)) {
        return NextResponse.json(
          {
            error:
              "Unauthorized: Service does not belong to your active client context",
          },
          { status: 403 }
        );
      }

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
        thumbnail_alt: thumbnailAltInput,
        service_code: serviceCode,
        tags,
        scheduled_publish_at: scheduledPublishAtInput,
        meta_title: metaTitle,
        meta_description: metaDescription,
        meta_keywords: metaKeywords,
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

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description ? sanitizeHtml(description) : null;
      if (content !== undefined) updateData.content = content ? sanitizeHtml(content) : null;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      const rawFee = fee !== undefined ? fee : price;
      if (rawFee !== undefined) {
        const feeNum = Number(rawFee);
        if (!Number.isFinite(feeNum)) {
          return NextResponse.json({ error: "price must be a valid number" }, { status: 400 });
        }
        updateData.fee = feeNum;
      }
      if (feeCurrencyInput !== undefined)
        updateData.feeCurrency = feeCurrencyInput;
      else if (currency !== undefined) updateData.feeCurrency = currency;
      if (duration !== undefined) updateData.duration = duration;
      if (active !== undefined) updateData.active = Boolean(active);
      if (featured !== undefined) updateData.featured = Boolean(featured);
      if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
      else if (imageUrl !== undefined) updateData.thumbnail = imageUrl;
      if (thumbnailAltInput !== undefined) updateData.thumbnailAlt = thumbnailAltInput ?? null;
      if (scheduledPublishAtInput !== undefined) {
        updateData.scheduledPublishAt = scheduledPublishAtInput ? new Date(scheduledPublishAtInput) : null;
      }
      if (serviceCode !== undefined) updateData.serviceCode = serviceCode;
      if (tags !== undefined) updateData.tags = tags;
      if (metaTitle !== undefined) updateData.metaTitle = metaTitle ?? null;
      if (metaDescription !== undefined) updateData.metaDescription = metaDescription ?? null;
      if (metaKeywords !== undefined) updateData.metaKeywords = metaKeywords ?? null;
      if (openGraphTitle !== undefined) updateData.openGraphTitle = openGraphTitle ?? null;
      if (openGraphDescription !== undefined) updateData.openGraphDescription = openGraphDescription ?? null;
      if (openGraphImage !== undefined) updateData.openGraphImage = openGraphImage ?? null;
      if (twitterTitle !== undefined) updateData.twitterTitle = twitterTitle ?? null;
      if (twitterDescription !== undefined) updateData.twitterDescription = twitterDescription ?? null;
      if (twitterImage !== undefined) updateData.twitterImage = twitterImage ?? null;
      if (canonicalUrl !== undefined) updateData.canonicalUrl = canonicalUrl ?? null;
      if (robotsMeta !== undefined) updateData.robotsMeta = robotsMeta;
      if (schemaType !== undefined) updateData.schemaType = schemaType;
      if (ctaHeading !== undefined) updateData.ctaHeading = ctaHeading ?? null;
      if (ctaBody !== undefined) updateData.ctaBody = ctaBody ?? null;
      if (ctaButtonText !== undefined) updateData.ctaButtonText = ctaButtonText ?? null;
      if (ctaButtonUrl !== undefined) updateData.ctaButtonUrl = ctaButtonUrl ?? null;
      if (allowSocialShare !== undefined) updateData.allowSocialShare = Boolean(allowSocialShare);

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: "No updatable fields provided" },
          { status: 400 }
        );
      }

      updateData.updatedBy = user.id;

      if (title !== undefined && title !== existing.title) {
        updateData.slug = await generateUniqueSlug(prisma, title, activeClientId, existing.slug);
      }

      // Recompute SEO score whenever SEO-related fields change
      const seoRelevantFields = [
        "metaTitle", "metaDescription", "metaKeywords", "thumbnail", "thumbnailAlt",
        "openGraphTitle", "openGraphDescription", "openGraphImage", "slug", "content", "description", "targetKeywords",
      ];
      const shouldRecomputeSeo = seoRelevantFields.some((f) => updateData[f] !== undefined);
      if (shouldRecomputeSeo) {
        const current = await prisma.wehowareService.findUnique({
          where: { id: serviceId },
          select: {
            metaTitle: true, metaDescription: true, metaKeywords: true,
            thumbnail: true, thumbnailAlt: true, slug: true,
            content: true, description: true, targetKeywords: true,
            openGraphTitle: true, openGraphDescription: true, openGraphImage: true,
          },
        });
        const merged = { ...current, ...updateData };
        const normalizedKeywords = targetKeywords !== undefined ? normalizeTargetKeywords(targetKeywords) : (merged.targetKeywords ?? []);
        updateData.seoScore = computeSeoScore({
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
        if (targetKeywords !== undefined) updateData.targetKeywords = normalizedKeywords;
      }

      const service = await prisma.wehowareService.update({
        where: { id: serviceId },
        data: updateData,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });

      return NextResponse.json({ service: serialize(service) });
    } catch (err) {
      console.error("[PUT /api/v1/services/[id]] error:", err);
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
      if (err?.code === "P2025") {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update service" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE (admin only)
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: serviceId } = await params;

      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required to delete a service" },
          { status: 400 }
        );
      }
      const activeClientId = user.activeClientId;

      const existing = await prisma.wehowareService.findUnique({
        where: { id: serviceId },
        select: { id: true, clientId: true, thumbnail: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      if (String(existing.clientId) !== String(activeClientId)) {
        return NextResponse.json(
          {
            error:
              "Unauthorized: Service does not belong to the admin's active client context",
          },
          { status: 403 }
        );
      }

      await prisma.wehowareService.delete({ where: { id: serviceId } });

      if (existing.thumbnail) {
        deleteThumbnailByUrl(existing.thumbnail).catch((err) =>
          console.warn("[DELETE /api/v1/services/[id]] thumbnail cleanup failed:", err.message)
        );
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/services/[id]] error:", err);
      if (err?.code === "P2025") {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete service" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
