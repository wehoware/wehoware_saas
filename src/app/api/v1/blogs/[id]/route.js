/**
 * /api/v1/blogs/[id]
 *
 * Prisma/MySQL-backed handlers for a single blog post.
 * GET    — fetch
 * PUT    — update (client/employee/admin)
 * DELETE — delete (admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

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
    created_by: b.createdBy,
    updated_by: b.updatedBy,
    meta_title: b.metaTitle,
    meta_description: b.metaDescription,
    meta_keywords: b.metaKeywords,
    wehoware_blog_categories: b.category ? { name: b.category.name } : null,
    wehoware_profiles: b.creator
      ? { first_name: b.creator.firstName, last_name: b.creator.lastName }
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

  let candidate = base || "post";
  let counter = 1;
  while (counter < 100) {
    const hit = await prisma.wehowareBlog.findFirst({
      where: { clientId, slug: candidate, NOT: currentSlug ? { slug: currentSlug } : undefined },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${base || "post"}-${counter}`;
    counter += 1;
  }
  return `${base || "post"}-${Date.now()}`;
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
      return NextResponse.json(
        { error: "Active client context required" },
        { status: 400 }
      );
    }

    const blog = await prisma.wehowareBlog.findFirst({
      where: { id, clientId },
      include: {
        category: { select: { id: true, name: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
    });

    if (!blog) {
      return NextResponse.json(
        { error: "Blog not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ blog: serialize(blog) });
  } catch (err) {
    console.error("[GET /api/v1/blogs/[id]] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch blog" },
      { status: 500 }
    );
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
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const {
        title,
        content,
        category_id,
        categoryId: categoryIdAlt,
        status,
        thumbnail,
        excerpt,
        slug: slugInput,
        tags,
        featured,
        read_time,
        meta_title,
        meta_description,
        meta_keywords,
      } = body ?? {};
      const categoryId = category_id ?? categoryIdAlt;

      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }

      // Ownership check
      const existing = await prisma.wehowareBlog.findFirst({
        where: { id, clientId },
        select: { id: true, title: true, slug: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      }

      let slug = existing.slug;
      if (slugInput?.trim()) {
        slug = slugInput.trim();
      } else if (title !== existing.title) {
        slug = await generateUniqueSlug(prisma, title, clientId, existing.slug);
      }

      const updateData = {
        title,
        slug,
        updatedBy: user.id,
      };
      if (content !== undefined) updateData.content = content;
      if (excerpt !== undefined) updateData.excerpt = excerpt ?? null;
      if (categoryId !== undefined) updateData.categoryId = categoryId ?? null;
      if (status !== undefined) updateData.status = status || "Draft";
      if (thumbnail !== undefined) updateData.thumbnail = thumbnail ?? null;
      if (tags !== undefined) updateData.tags = tags;
      if (featured !== undefined) updateData.featured = featured;
      if (read_time !== undefined) updateData.readTime = read_time ?? null;
      if (meta_title !== undefined) updateData.metaTitle = meta_title ?? null;
      if (meta_description !== undefined) updateData.metaDescription = meta_description ?? null;
      if (meta_keywords !== undefined) updateData.metaKeywords = meta_keywords ?? null;

      const blog = await prisma.wehowareBlog.update({
        where: { id },
        data: updateData,
        include: { category: { select: { id: true, name: true } } },
      });

      return NextResponse.json({ blog: serialize(blog) });
    } catch (err) {
      console.error("[PUT /api/v1/blogs/[id]] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid category_id" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update blog" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE (admin only)
// -------------------------------------------------------------------
export const DELETE = withAuth(
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

      const existing = await prisma.wehowareBlog.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Blog not found" },
          { status: 404 }
        );
      }

      await prisma.wehowareBlog.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/blogs/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete blog" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
