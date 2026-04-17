/**
 * /api/v1/seo/static-pages/[id]
 *
 * Prisma/MySQL-backed handlers for a single static page.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function serialize(p) {
  return {
    id: p.id,
    client_id: p.clientId,
    page_slug: p.pageSlug,
    title: p.title,
    content: p.content,
    template_name: p.templateName,
    layout: p.layout,
    meta_title: p.metaTitle,
    meta_description: p.metaDescription,
    meta_keywords: p.metaKeywords,
    open_graph_title: p.openGraphTitle,
    open_graph_description: p.openGraphDescription,
    open_graph_image: p.openGraphImage,
    is_active: p.isActive,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function resolveAllowedClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

async function loadAndAuthorize(prisma, user, id) {
  if (!id) {
    return { status: 400, body: { error: "Static Page ID is required." } };
  }
  const page = await prisma.wehowareStaticPage.findUnique({ where: { id } });
  if (!page) {
    return { status: 404, body: { error: "Static page not found." } };
  }
  const allowedClient = resolveAllowedClientId(user);
  if (!allowedClient || page.clientId !== allowedClient) {
    return {
      status: 403,
      body: {
        error: "Forbidden: You do not have permission to access this page.",
      },
    };
  }
  return { status: 200, data: page };
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const { status, body, data } = await loadAndAuthorize(prisma, user, id);
      if (status !== 200) return NextResponse.json(body, { status });
      return NextResponse.json({ data: serialize(data) });
    } catch (err) {
      console.error("[GET /api/v1/seo/static-pages/[id]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT  (page_slug is intentionally NOT updatable)
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const auth = await loadAndAuthorize(prisma, user, id);
      if (auth.status !== 200) {
        return NextResponse.json(auth.body, { status: auth.status });
      }

      const body = await request.json();
      const data = {};
      if (body.title !== undefined) data.title = body.title;
      if (body.content !== undefined) data.content = body.content;
      if (body.template_name !== undefined) data.templateName = body.template_name;
      if (body.layout !== undefined) data.layout = body.layout;
      if (body.meta_title !== undefined) data.metaTitle = body.meta_title;
      if (body.meta_description !== undefined) {
        data.metaDescription = body.meta_description;
      }
      if (body.meta_keywords !== undefined) data.metaKeywords = body.meta_keywords;
      if (body.open_graph_title !== undefined) {
        data.openGraphTitle = body.open_graph_title;
      }
      if (body.open_graph_description !== undefined) {
        data.openGraphDescription = body.open_graph_description;
      }
      if (body.open_graph_image !== undefined) {
        data.openGraphImage = body.open_graph_image;
      }
      if (body.is_active !== undefined) data.isActive = Boolean(body.is_active);

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update." },
          { status: 400 }
        );
      }

      const updated = await prisma.wehowareStaticPage.update({
        where: { id },
        data,
      });
      return NextResponse.json({ data: serialize(updated) });
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      console.error("[PUT /api/v1/seo/static-pages/[id]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const auth = await loadAndAuthorize(prisma, user, id);
      if (auth.status !== 200) {
        return NextResponse.json(auth.body, { status: auth.status });
      }
      await prisma.wehowareStaticPage.delete({ where: { id } });
      return NextResponse.json({
        message: "Static page deleted successfully.",
      });
    } catch (err) {
      console.error("[DELETE /api/v1/seo/static-pages/[id]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
