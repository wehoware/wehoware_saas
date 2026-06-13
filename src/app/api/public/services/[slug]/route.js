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
    views: s.views,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    meta_title: s.metaTitle,
    meta_description: s.metaDescription,
    meta_keywords: s.metaKeywords,
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

function buildFaqSchema(faqs) {
  if (!faqs || faqs.length === 0) return null;
  const activeFaqs = faqs.filter((f) => f.active).sort((a, b) => a.displayOrder - b.displayOrder);
  if (activeFaqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: activeFaqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
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

    return NextResponse.json({ service: serialize(service) });
  } catch (err) {
    console.error("[GET /api/public/services/[slug]] error:", err);
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 });
  }
}
