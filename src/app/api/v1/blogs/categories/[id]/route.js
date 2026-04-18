/**
 * /api/v1/blogs/categories/[id]
 * GET / PUT / DELETE for a single blog category
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(c) {
  return {
    id: c.id, client_id: c.clientId, name: c.name, slug: c.slug,
    description: c.description, icon_url: c.iconUrl, active: c.active,
    created_at: c.createdAt, updated_at: c.updatedAt,
    created_by: c.createdBy, updated_by: c.updatedBy,
  };
}

async function load(prisma, user, id) {
  const clientId = resolveClientId(user);
  if (!clientId) return { status: 400, body: { error: "Active client context required" } };
  const cat = await prisma.wehowareBlogCategory.findFirst({ where: { id, clientId } });
  if (!cat) return { status: 404, body: { error: "Category not found" } };
  return { status: 200, data: cat };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const res = await load(prisma, user, id);
    if (res.status !== 200) return NextResponse.json(res.body, { status: res.status });
    return NextResponse.json({ data: serialize(res.data) });
  } catch (err) {
    console.error("[GET /api/v1/blogs/categories/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const auth = await load(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });

    const body = await request.json();
    const data = { updatedBy: user.id };
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.icon_url !== undefined || body.iconUrl !== undefined) data.iconUrl = body.icon_url ?? body.iconUrl;
    if (body.active !== undefined) data.active = Boolean(body.active);

    if (Object.keys(data).length === 1) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    const updated = await prisma.wehowareBlogCategory.update({ where: { id }, data });
    return NextResponse.json({ data: serialize(updated) });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[PUT /api/v1/blogs/categories/[id]]", err);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const auth = await load(prisma, user, id);
    if (auth.status !== 200) return NextResponse.json(auth.body, { status: auth.status });
    await prisma.wehowareBlogCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v1/blogs/categories/[id]]", err);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}, { allowedRoles: ["employee", "admin"] });
