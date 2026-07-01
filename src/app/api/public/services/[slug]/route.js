/**
 * GET /api/public/services/[slug]
 *
 * Fetch a single active service by slug for a client.
 * Increments views atomically on each fetch.
 *
 * Usage:
 *   GET /api/public/services/legal-advice?domain=example.com
 *   GET /api/public/services/legal-advice?clientId=uuid-here
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveClient,
  buildFaqSchema,
  buildServiceSchema,
  buildBreadcrumbSchema,
} from "@/lib/public-seo";

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
    related_blogs: (s.relatedBlogs ?? []).map((r) => ({
      id: r.blog.id,
      title: r.blog.title,
      slug: r.blog.slug,
      thumbnail: r.blog.thumbnail,
      excerpt: r.blog.excerpt,
    })),
    faqs: (s.faqs ?? [])
      .filter((f) => f.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        display_order: f.displayOrder,
      })),
    faq_schema: buildFaqSchema(s.faqs),
  };
}

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
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

    const service = await prisma.wehowareService.findFirst({
      where: { clientId: client.id, slug, active: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        relatedBlogs: {
          include: {
            blog: { select: { id: true, title: true, slug: true, thumbnail: true, excerpt: true } },
          },
        },
        faqs: { orderBy: { displayOrder: "asc" } },
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Increment views atomically (non-blocking)
    prisma.wehowareService.update({
      where: { id: service.id },
      data: { views: { increment: 1 } },
    }).catch(() => {});

    const siteUrl = client.domain ? `https://${client.domain}` : "";
    const breadcrumbTrail = [
      { name: "Home", url: siteUrl || "/" },
    ];
    if (service.category && service.category.name) {
      breadcrumbTrail.push({
        name: service.category.name,
        url: siteUrl ? `${siteUrl}/services?categoryId=${service.category.id}` : `/services?categoryId=${service.category.id}`,
      });
    }
    breadcrumbTrail.push({
      name: service.title,
      url: service.canonicalUrl || (siteUrl ? `${siteUrl}/services/${service.slug}` : `/services/${service.slug}`),
    });

    return NextResponse.json({
      service: serialize(service),
      service_schema: buildServiceSchema(service, client),
      breadcrumb_schema: buildBreadcrumbSchema(breadcrumbTrail),
    });
  } catch (err) {
    console.error("[GET /api/public/services/[slug]] error:", err);
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 });
  }
}
