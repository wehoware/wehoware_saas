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

    const response = {
      ...blog,
      wehoware_blog_categories: blog.category
        ? { name: blog.category.name }
        : null,
      wehoware_profiles: blog.creator
        ? {
            first_name: blog.creator.firstName,
            last_name: blog.creator.lastName,
          }
        : null,
    };

    return NextResponse.json({ blog: response });
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
        category_id: categoryId,
        status,
        thumbnail,
        excerpt,
      } = body ?? {};

      if (!title || !content || !categoryId) {
        return NextResponse.json(
          { error: "Title, content, and category are required" },
          { status: 400 }
        );
      }

      // Ownership check
      const existing = await prisma.wehowareBlog.findFirst({
        where: { id, clientId },
        select: { id: true, title: true, slug: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Blog not found" },
          { status: 404 }
        );
      }

      const updateData = {
        title,
        content,
        excerpt: excerpt ?? null,
        categoryId,
        status: status || "Draft",
        thumbnail: thumbnail ?? null,
        updatedBy: user.id,
      };

      if (title !== existing.title) {
        updateData.slug = await generateUniqueSlug(
          prisma,
          title,
          clientId,
          existing.slug
        );
      }

      const blog = await prisma.wehowareBlog.update({
        where: { id },
        data: updateData,
        include: { category: { select: { id: true, name: true } } },
      });

      return NextResponse.json({ blog });
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
