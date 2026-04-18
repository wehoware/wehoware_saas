/**
 * /api/v1/blogs/categories
 * GET  — list blog categories for caller's client
 * POST — create a new category (employee/admin)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(c) {
  return {
    id: c.id,
    client_id: c.clientId,
    name: c.name,
    slug: c.slug,
    description: c.description,
    icon_url: c.iconUrl,
    active: c.active,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    created_by: c.createdBy,
    updated_by: c.updatedBy,
  };
}

async function generateSlug(prisma, name, currentSlug = null) {
  const base = String(name).toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-").replace(/^-+|-+$/g, "") || "category";
  if (base === currentSlug) return base;
  let candidate = base;
  let counter = 1;
  while (counter < 100) {
    const hit = await prisma.wehowareBlogCategory.findFirst({ where: { slug: candidate }, select: { id: true } });
    if (!hit) return candidate;
    candidate = `${base}-${counter++}`;
  }
  return `${base}-${Date.now()}`;
}

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const url = new URL(request.url);
    const active = url.searchParams.get("active");
    const where = { clientId };
    if (active === "true") where.active = true;
    if (active === "false") where.active = false;

    const categories = await prisma.wehowareBlogCategory.findMany({ where, orderBy: { name: "asc" } });
    return NextResponse.json({ data: categories.map(serialize) });
  } catch (err) {
    console.error("[GET /api/v1/blogs/categories]", err);
    return NextResponse.json({ error: "Failed to fetch blog categories" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });

export const POST = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const body = await request.json();
    if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const slug = await generateSlug(prisma, body.name);
    const category = await prisma.wehowareBlogCategory.create({
      data: {
        clientId,
        name: body.name,
        slug,
        description: body.description ?? null,
        iconUrl: body.icon_url ?? body.iconUrl ?? null,
        active: body.active !== undefined ? Boolean(body.active) : true,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    return NextResponse.json({ data: serialize(category) }, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    if (err?.code === "P2002") return NextResponse.json({ error: "A category with this slug already exists" }, { status: 409 });
    console.error("[POST /api/v1/blogs/categories]", err);
    return NextResponse.json({ error: "Failed to create blog category" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
