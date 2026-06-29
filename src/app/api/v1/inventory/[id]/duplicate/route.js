/**
 * POST /api/v1/inventory/[id]/duplicate
 *
 * Clone an inventory item. Duplicate is always inactive, with a unique slug.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

async function generateUniqueSlug(prisma, base, clientId) {
  let candidate = `${base}-copy`;
  for (let i = 1; i < 100; i++) {
    const hit = await prisma.wehowareInventoryItem.findFirst({
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

      const original = await prisma.wehowareInventoryItem.findFirst({
        where: { id, clientId },
      });
      if (!original) {
        return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
      }

      const newSlug = await generateUniqueSlug(prisma, original.slug, clientId);

      const duplicate = await prisma.wehowareInventoryItem.create({
        data: {
          clientId,
          categoryId: original.categoryId,
          title: `${original.title} (Copy)`,
          slug: newSlug,
          type: original.type,
          sku: original.sku,
          description: original.description,
          content: original.content,
          thumbnail: original.thumbnail,
          thumbnailAlt: original.thumbnailAlt,
          price: original.price,
          currency: original.currency,
          priceVisible: original.priceVisible,
          quantity: 0,
          reorderThreshold: original.reorderThreshold,
          status: "in_stock",
          tags: original.tags,
          active: false,
          featured: false,
          attributes: original.attributes,
          images: original.images,
          videos: original.videos,
          metaTitle: original.metaTitle,
          metaDescription: original.metaDescription,
          metaKeywords: original.metaKeywords,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return NextResponse.json({ item: { id: duplicate.id, slug: duplicate.slug } }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/inventory/[id]/duplicate] error:", err);
      return NextResponse.json({ error: "Failed to duplicate inventory item" }, { status: 500 });
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
