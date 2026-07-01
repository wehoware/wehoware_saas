/**
 * POST /api/public/blogs/[slug]/like
 *
 * Increment likes on a published blog. Idempotent — no user tracking,
 * simply increments the counter. Rate-limiting is the caller's responsibility.
 *
 * Usage:
 *   POST /api/public/blogs/my-post/like?domain=example.com
 *   POST /api/public/blogs/my-post/like?clientId=uuid-here
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveClient } from "@/lib/public-seo";

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain")?.trim();
    const clientId = url.searchParams.get("clientId")?.trim();

    const client = await resolveClient(domain, clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (client.inactive) {
      return NextResponse.json({ error: "Client is inactive" }, { status: 403 });
    }

    const blog = await prisma.wehowareBlog.findFirst({
      where: { clientId: client.id, slug, status: "Published" },
      select: { id: true },
    });
    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    const updated = await prisma.wehowareBlog.update({
      where: { id: blog.id },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    });

    return NextResponse.json({ likes: updated.likes });
  } catch (err) {
    console.error("[POST /api/public/blogs/[slug]/like] error:", err);
    return NextResponse.json({ error: "Failed to update likes" }, { status: 500 });
  }
}
