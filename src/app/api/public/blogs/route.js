/**
 * /api/public/blogs
 *
 * Public API endpoint for fetching blogs without authentication.
 * Scoped to a specific client via domain or clientId query parameter.
 * Only returns published blogs.
 *
 * Usage:
 *   GET /api/public/blogs?domain=hadi-consultant.vercel.app
 *   GET /api/public/blogs?clientId=uuid-here
 *   GET /api/public/blogs?domain=hadi-consultant.vercel.app&category=uuid&featured=true
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "published_at",
  "title",
]);

const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  published_at: "publishedAt",
  title: "title",
};

function serialize(b) {
  return {
    id: b.id,
    client_id: b.clientId,
    title: b.title,
    slug: b.slug,
    excerpt: b.excerpt,
    content: b.content,
    thumbnail: b.thumbnail,
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
  };
}

async function resolveClient(domain, clientId) {
  if (!domain && !clientId) {
    return null;
  }

  const where = {};
  if (domain) {
    where.domain = domain;
  }
  if (clientId) {
    where.id = clientId;
  }

  const client = await prisma.wehowareClient.findFirst({
    where,
    select: { id: true, active: true },
  });

  if (!client) {
    return null;
  }

  if (!client.active) {
    return { inactive: true, id: client.id };
  }

  return client;
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

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10))
    );
    const search = (url.searchParams.get("search") || "").trim();
    const category = url.searchParams.get("category") || "";
    const featured = url.searchParams.get("featured");
    const sortByRaw = url.searchParams.get("sortBy") || "published_at";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const sortBy = SORTABLE_FIELDS.has(sortByRaw)
      ? FIELD_MAP[sortByRaw]
      : "publishedAt";

    const where = { clientId: client.id, status: "Published" };
    if (category) where.categoryId = category;
    if (featured === "true") where.featured = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { excerpt: { contains: search } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      prisma.wehowareBlog.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareBlog.count({ where }),
    ]);

    const blogs = items.map(serialize);

    return NextResponse.json({
      blogs,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    console.error("[GET /api/public/blogs] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch blogs" },
      { status: 500 }
    );
  }
}
