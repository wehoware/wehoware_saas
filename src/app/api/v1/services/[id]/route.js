/**
 * /api/v1/services/[id]
 *
 * Prisma/MySQL-backed handlers for a single service.
 * GET    — fetch
 * PUT    — update (employee/admin)
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

async function generateUniqueSlug(prisma, title, currentSlug = null) {
  const base = String(title)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base && base === currentSlug) return base;

  let candidate = base || "service";
  let counter = 1;
  while (counter < 100) {
    const hit = await prisma.wehowareService.findFirst({
      where: {
        slug: candidate,
        NOT: currentSlug ? { slug: currentSlug } : undefined,
      },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${base || "service"}-${counter}`;
    counter += 1;
  }
  return `${base || "service"}-${Date.now()}`;
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
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

      const service = await prisma.wehowareService.findFirst({
        where: { id, clientId },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });

      if (!service) {
        return NextResponse.json(
          {
            error:
              "Service not found or not accessible within your current context",
          },
          { status: 404 }
        );
      }

      const response = {
        ...service,
        wehoware_service_categories: service.category
          ? {
              id: service.category.id,
              name: service.category.name,
              slug: service.category.slug,
            }
          : null,
      };

      return NextResponse.json({ service: response });
    } catch (err) {
      console.error("[GET /api/v1/services/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch service" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: serviceId } = await params;

      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required to update a service" },
          { status: 400 }
        );
      }
      const activeClientId = user.activeClientId;

      const body = await request.json();

      // Fetch existing for ownership + slug diffing
      const existing = await prisma.wehowareService.findUnique({
        where: { id: serviceId },
        select: { id: true, clientId: true, title: true, slug: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      if (String(existing.clientId) !== String(activeClientId)) {
        return NextResponse.json(
          {
            error:
              "Unauthorized: Service does not belong to your active client context",
          },
          { status: 403 }
        );
      }

      const {
        title,
        description,
        content,
        category_id: categoryId,
        price,
        fee,
        currency,
        fee_currency: feeCurrencyInput,
        duration,
        active,
        featured,
        image_url: imageUrl,
        thumbnail,
        service_code: serviceCode,
        tags,
        meta_title: metaTitle,
        meta_description: metaDescription,
        meta_keywords: metaKeywords,
      } = body ?? {};

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (content !== undefined) updateData.content = content;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (fee !== undefined) updateData.fee = fee;
      else if (price !== undefined) updateData.fee = price;
      if (feeCurrencyInput !== undefined)
        updateData.feeCurrency = feeCurrencyInput;
      else if (currency !== undefined) updateData.feeCurrency = currency;
      if (duration !== undefined) updateData.duration = duration;
      if (active !== undefined) updateData.active = Boolean(active);
      if (featured !== undefined) updateData.featured = Boolean(featured);
      if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
      else if (imageUrl !== undefined) updateData.thumbnail = imageUrl;
      if (serviceCode !== undefined) updateData.serviceCode = serviceCode;
      if (tags !== undefined) updateData.tags = tags;
      if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
      if (metaDescription !== undefined)
        updateData.metaDescription = metaDescription;
      if (metaKeywords !== undefined) updateData.metaKeywords = metaKeywords;

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: "No updatable fields provided" },
          { status: 400 }
        );
      }

      updateData.updatedBy = user.id;

      if (title !== undefined && title !== existing.title) {
        updateData.slug = await generateUniqueSlug(
          prisma,
          title,
          existing.slug
        );
      }

      const service = await prisma.wehowareService.update({
        where: { id: serviceId },
        data: updateData,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });

      const response = {
        ...service,
        wehoware_service_categories: service.category
          ? {
              id: service.category.id,
              name: service.category.name,
              slug: service.category.slug,
            }
          : null,
      };

      return NextResponse.json({ service: response });
    } catch (err) {
      console.error("[PUT /api/v1/services/[id]] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid category_id" },
          { status: 400 }
        );
      }
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A service with this slug already exists" },
          { status: 409 }
        );
      }
      if (err?.code === "P2025") {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update service" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE (admin only)
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: serviceId } = await params;

      if (!user.activeClientId) {
        return NextResponse.json(
          { error: "Active client context required to delete a service" },
          { status: 400 }
        );
      }
      const activeClientId = user.activeClientId;

      const existing = await prisma.wehowareService.findUnique({
        where: { id: serviceId },
        select: { id: true, clientId: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      if (String(existing.clientId) !== String(activeClientId)) {
        return NextResponse.json(
          {
            error:
              "Unauthorized: Service does not belong to the admin's active client context",
          },
          { status: 403 }
        );
      }

      await prisma.wehowareService.delete({ where: { id: serviceId } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/services/[id]] error:", err);
      if (err?.code === "P2025") {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete service" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
