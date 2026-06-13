/**
 * POST /api/v1/blogs/[id]/duplicate
 *
 * Clone a blog post. The duplicate is always created as a Draft with a
 * unique slug derived from the original title (e.g. "My Post copy").
 * publishedAt and scheduledPublishAt are cleared.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  return user.activeClientId ?? null;
}

async function generateUniqueSlug(prisma, base, clientId) {
  let candidate = `${base}-copy`;
  for (let i = 1; i < 100; i++) {
    const hit = await prisma.wehowareBlog.findFirst({
      where: { clientId, slug: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${base}-copy-${i}`;
  }
  return `${base}-copy-${Date.now()}`;
}

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const original = await prisma.wehowareBlog.findFirst({
        where: { id, clientId },
      });
      if (!original) {
        return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      }

      const newSlug = await generateUniqueSlug(prisma, original.slug, clientId);

      const duplicate = await prisma.wehowareBlog.create({
        data: {
          clientId,
          title: `${original.title} (Copy)`,
          slug: newSlug,
          content: original.content,
          excerpt: original.excerpt,
          thumbnail: original.thumbnail,
          thumbnailAlt: original.thumbnailAlt,
          status: "Draft",
          categoryId: original.categoryId,
          featured: false,
          readTime: original.readTime,
          tags: original.tags,
          metaTitle: original.metaTitle,
          metaDescription: original.metaDescription,
          metaKeywords: original.metaKeywords,
          publishedAt: null,
          scheduledPublishAt: null,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return NextResponse.json({ blog: { id: duplicate.id, slug: duplicate.slug } }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/blogs/[id]/duplicate] error:", err);
      return NextResponse.json({ error: "Failed to duplicate blog" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
