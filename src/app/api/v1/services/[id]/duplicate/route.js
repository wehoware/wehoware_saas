/**
 * POST /api/v1/services/[id]/duplicate
 *
 * Clone a service. Duplicate is always inactive, with a unique slug.
 * scheduledPublishAt is cleared.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

async function generateUniqueSlug(prisma, base, clientId) {
  let candidate = `${base}-copy`;
  for (let i = 1; i < 100; i++) {
    const hit = await prisma.wehowareService.findFirst({
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

      if (!user.activeClientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }
      const clientId = user.activeClientId;

      const original = await prisma.wehowareService.findFirst({
        where: { id, clientId },
      });
      if (!original) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }

      const newSlug = await generateUniqueSlug(prisma, original.slug, clientId);

      const duplicate = await prisma.wehowareService.create({
        data: {
          clientId,
          title: `${original.title} (Copy)`,
          slug: newSlug,
          description: original.description,
          content: original.content,
          thumbnail: original.thumbnail,
          thumbnailAlt: original.thumbnailAlt,
          categoryId: original.categoryId,
          fee: original.fee,
          feeCurrency: original.feeCurrency,
          serviceCode: original.serviceCode,
          duration: original.duration,
          tags: original.tags,
          active: false,
          featured: false,
          scheduledPublishAt: null,
          metaTitle: original.metaTitle,
          metaDescription: original.metaDescription,
          metaKeywords: original.metaKeywords,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return NextResponse.json({ service: { id: duplicate.id, slug: duplicate.slug } }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/services/[id]/duplicate] error:", err);
      return NextResponse.json({ error: "Failed to duplicate service" }, { status: 500 });
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
