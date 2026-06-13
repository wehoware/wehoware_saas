/**
 * /api/v1/blogs/[id]
 *
 * Prisma/MySQL-backed handlers for a single blog post.
 * GET    — fetch
 * PUT    — update (client/employee/admin)
 * DELETE — delete (admin/employee); cleans up stored thumbnail
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { deleteThumbnailByUrl } from "@/lib/storage";
import { sanitizeHtml } from "@/lib/sanitize";
import { computeSeoScore, normalizeTargetKeywords } from "@/lib/seoScore";

const VALID_STATUSES = new Set(["Draft", "Published", "Archived"]);

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
    scheduled_publish_at: b.scheduledPublishAt,
    created_by: b.createdBy,
    updated_by: b.updatedBy,
    meta_title: b.metaTitle,
    meta_description: b.metaDescription,
    meta_keywords: b.metaKeywords,
    open_graph_title: b.openGraphTitle,
    open_graph_description: b.openGraphDescription,
    open_graph_image: b.openGraphImage,
    twitter_title: b.twitterTitle,
    twitter_description: b.twitterDescription,
    twitter_image: b.twitterImage,
    canonical_url: b.canonicalUrl,
    robots_meta: b.robotsMeta,
    schema_type: b.schemaType,
    seo_score: b.seoScore,
    target_keywords: b.targetKeywords,
    show_toc: b.showToc,
    show_author_box: b.showAuthorBox,
    cta_heading: b.ctaHeading,
    cta_body: b.ctaBody,
    cta_button_text: b.ctaButtonText,
    cta_button_url: b.ctaButtonUrl,
    allow_social_share: b.allowSocialShare,
    wehoware_blog_categories: b.category ? { name: b.category.name } : null,
    wehoware_profiles: b.creator
      ? { first_name: b.creator.firstName, last_name: b.creator.lastName }
      : null,
  };
}

function calcReadTime(html) {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
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

  const fallback = base || "post";
  let candidate = fallback;
  for (let counter = 1; counter < 100; counter++) {
    const notCurrent = currentSlug ? { NOT: { slug: currentSlug } } : {};
    const hit = await prisma.wehowareBlog.findFirst({
      where: { clientId, slug: candidate, ...notCurrent },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${fallback}-${counter}`;
  }
  return `${fallback}-${Date.now()}`;
}

async function resolveSlug(prisma, { slugInput, title, existing, clientId }) {
  if (slugInput?.trim()) return slugInput.trim();
  if (title !== existing.title) return generateUniqueSlug(prisma, title, clientId, existing.slug);
  return existing.slug;
}

function computePublishedAt(status, existingPublishedAt) {
  if (status === "Published" && !existingPublishedAt) return new Date();
  if (status !== "Published") return null;
  return existingPublishedAt; // already published — keep original stamp
}

function buildUpdateData(body, slug, userId, existing) {
  const {
    content, excerpt, category_id, categoryId: categoryIdAlt,
    status, thumbnail, thumbnail_alt, tags, featured, read_time,
    scheduled_publish_at, meta_title, meta_description, meta_keywords,
    open_graph_title, open_graph_description, open_graph_image,
    twitter_title, twitter_description, twitter_image,
    canonical_url, robots_meta, schema_type, target_keywords,
    show_toc, show_author_box,
    cta_heading, cta_body, cta_button_text, cta_button_url,
    allow_social_share,
  } = body;

  const categoryId = category_id ?? categoryIdAlt;
  const data = { title: body.title, slug, updatedBy: userId };

  let sanitizedContent;
  if (content !== undefined) {
    sanitizedContent = sanitizeHtml(content);
    data.content = sanitizedContent;
  }
  if (excerpt !== undefined) data.excerpt = excerpt ? sanitizeHtml(excerpt) : null;
  if (categoryId !== undefined) data.categoryId = categoryId ?? null;
  if (thumbnail !== undefined) data.thumbnail = thumbnail ?? null;
  if (thumbnail_alt !== undefined) data.thumbnailAlt = thumbnail_alt ?? null;
  if (tags !== undefined) data.tags = tags;
  if (featured !== undefined) data.featured = featured;
  if (read_time !== undefined) {
    data.readTime = read_time ?? null;
  } else if (sanitizedContent !== undefined) {
    data.readTime = calcReadTime(sanitizedContent);
  }
  if (scheduled_publish_at !== undefined) {
    data.scheduledPublishAt = scheduled_publish_at ? new Date(scheduled_publish_at) : null;
  }
  if (meta_title !== undefined) data.metaTitle = meta_title ?? null;
  if (meta_description !== undefined) data.metaDescription = meta_description ?? null;
  if (meta_keywords !== undefined) data.metaKeywords = meta_keywords ?? null;
  if (open_graph_title !== undefined) data.openGraphTitle = open_graph_title ?? null;
  if (open_graph_description !== undefined) data.openGraphDescription = open_graph_description ?? null;
  if (open_graph_image !== undefined) data.openGraphImage = open_graph_image ?? null;
  if (twitter_title !== undefined) data.twitterTitle = twitter_title ?? null;
  if (twitter_description !== undefined) data.twitterDescription = twitter_description ?? null;
  if (twitter_image !== undefined) data.twitterImage = twitter_image ?? null;
  if (canonical_url !== undefined) data.canonicalUrl = canonical_url ?? null;
  if (robots_meta !== undefined) data.robotsMeta = robots_meta;
  if (schema_type !== undefined) data.schemaType = schema_type;
  if (show_toc !== undefined) data.showToc = Boolean(show_toc);
  if (show_author_box !== undefined) data.showAuthorBox = Boolean(show_author_box);
  if (cta_heading !== undefined) data.ctaHeading = cta_heading ?? null;
  if (cta_body !== undefined) data.ctaBody = cta_body ?? null;
  if (cta_button_text !== undefined) data.ctaButtonText = cta_button_text ?? null;
  if (cta_button_url !== undefined) data.ctaButtonUrl = cta_button_url ?? null;
  if (allow_social_share !== undefined) data.allowSocialShare = Boolean(allow_social_share);

  if (status !== undefined) {
    data.status = status || "Draft";
    data.publishedAt = computePublishedAt(status, existing.publishedAt);
  }

  // Recompute SEO score if any SEO-related field changed
  const seoRelevantFields = [
    "metaTitle", "metaDescription", "metaKeywords", "thumbnail", "thumbnailAlt",
    "openGraphTitle", "openGraphDescription", "openGraphImage", "slug", "content", "excerpt", "targetKeywords",
  ];
  const shouldRecomputeSeo = seoRelevantFields.some((f) => data[f] !== undefined);
  if (shouldRecomputeSeo) {
    const normalizedKeywords = target_keywords !== undefined ? normalizeTargetKeywords(target_keywords) : (existing.targetKeywords ?? []);
    data.seoScore = computeSeoScore({
      metaTitle: data.metaTitle ?? existing.metaTitle,
      metaDescription: data.metaDescription ?? existing.metaDescription,
      metaKeywords: data.metaKeywords ?? existing.metaKeywords,
      thumbnail: data.thumbnail ?? existing.thumbnail,
      thumbnailAlt: data.thumbnailAlt ?? existing.thumbnailAlt,
      openGraphTitle: data.openGraphTitle ?? existing.openGraphTitle,
      openGraphDescription: data.openGraphDescription ?? existing.openGraphDescription,
      openGraphImage: data.openGraphImage ?? existing.openGraphImage,
      slug: data.slug ?? existing.slug,
      content: data.content ?? data.excerpt ?? existing.content ?? existing.excerpt,
      targetKeywords: normalizedKeywords,
    });
    if (target_keywords !== undefined) data.targetKeywords = normalizedKeywords;
  }

  return data;
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;

    const clientId = resolveClientId(user);
    if (!clientId) {
      return NextResponse.json({ error: "Active client context required" }, { status: 400 });
    }

    const blog = await prisma.wehowareBlog.findFirst({
      where: { id, clientId },
      include: {
        category: { select: { id: true, name: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
    });

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    return NextResponse.json({ blog: serialize(blog) });
  } catch (err) {
    console.error("[GET /api/v1/blogs/[id]] error:", err);
    return NextResponse.json({ error: "Failed to fetch blog" }, { status: 500 });
  }
});

// -------------------------------------------------------------------
// PUT
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const body = await request.json();
      const { title, status, slug: slugInput } = body ?? {};

      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      if (status !== undefined && !VALID_STATUSES.has(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` },
          { status: 400 }
        );
      }

      // Include publishedAt so we can conditionally stamp it on first publish
      const existing = await prisma.wehowareBlog.findFirst({
        where: { id, clientId },
        select: { id: true, title: true, slug: true, publishedAt: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      }

      const slug = await resolveSlug(prisma, { slugInput, title, existing, clientId });
      const updateData = buildUpdateData(body, slug, user.id, existing);

      const blog = await prisma.wehowareBlog.update({
        where: { id },
        data: updateData,
        include: { category: { select: { id: true, name: true } } },
      });

      return NextResponse.json({ blog: serialize(blog) });
    } catch (err) {
      console.error("[PUT /api/v1/blogs/[id]] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json({ error: "Invalid category_id" }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to update blog" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE (admin / employee only)
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const existing = await prisma.wehowareBlog.findFirst({
        where: { id, clientId },
        select: { id: true, thumbnail: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      }

      await prisma.wehowareBlog.delete({ where: { id } });

      // Clean up stored thumbnail after successful DB deletion (non-blocking)
      if (existing.thumbnail) {
        deleteThumbnailByUrl(existing.thumbnail).catch((err) =>
          console.warn("[DELETE /api/v1/blogs/[id]] thumbnail cleanup failed:", err.message)
        );
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/blogs/[id]] error:", err);
      return NextResponse.json({ error: "Failed to delete blog" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
