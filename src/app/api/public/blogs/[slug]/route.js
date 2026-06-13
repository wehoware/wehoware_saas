/**
 * GET /api/public/blogs/[slug]
 *
 * Fetch a single published blog by slug for a client.
 * Increments views atomically on each fetch.
 *
 * Usage:
 *   GET /api/public/blogs/my-post?domain=example.com
 *   GET /api/public/blogs/my-post?clientId=uuid-here
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serialize(b) {
  return {
    id: b.id,
    client_id: b.clientId,
    title: b.title,
    slug: b.slug,
    excerpt: b.excerpt,
    content: b.content,
    thumbnail: b.thumbnail,
    thumbnail_alt: b.thumbnailAlt,
    status: b.status,
    category_id: b.categoryId,
    featured: b.featured,
    read_time: b.readTime,
    views: b.views,
    likes: b.likes,
    tags: b.tags,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    published_at: b.publishedAt,
    meta_title: b.metaTitle,
    meta_description: b.metaDescription,
    meta_keywords: b.metaKeywords,
    wehoware_blog_categories: b.category
      ? { id: b.category.id, name: b.category.name }
      : null,
    related_services: (b.relatedServices ?? []).map((r) => ({
      id: r.service.id,
      title: r.service.title,
      slug: r.service.slug,
      thumbnail: r.service.thumbnail,
      description: r.service.description,
      fee: r.service.fee ? Number(r.service.fee) : null,
      fee_currency: r.service.feeCurrency,
    })),
    faqs: (b.faqs ?? [])
      .filter((f) => f.active)
      .sort((a, b2) => a.displayOrder - b2.displayOrder)
      .map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        display_order: f.displayOrder,
      })),
    faq_schema: buildFaqSchema(b.faqs),
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

    const blog = await prisma.wehowareBlog.findFirst({
      where: { clientId: client.id, slug, status: "Published" },
      include: {
        category: { select: { id: true, name: true } },
        relatedServices: {
          include: {
            service: {
              select: {
                id: true, title: true, slug: true, thumbnail: true,
                description: true, fee: true, feeCurrency: true,
              },
            },
          },
        },
        faqs: { orderBy: { displayOrder: "asc" } },
      },
    });

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    // Increment views atomically (non-blocking)
    prisma.wehowareBlog.update({
      where: { id: blog.id },
      data: { views: { increment: 1 } },
    }).catch(() => {});

    return NextResponse.json({ blog: serialize(blog) });
  } catch (err) {
    console.error("[GET /api/public/blogs/[slug]] error:", err);
    return NextResponse.json({ error: "Failed to fetch blog" }, { status: 500 });
  }
}
