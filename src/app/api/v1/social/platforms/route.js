/**
 * GET /api/v1/social/platforms
 * Returns all active social media platforms.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

export const GET = withAuth(async (request) => {
  try {
    const { prisma } = request;
    const platforms = await prisma.wehowareSocialPlatform.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        platformCode: true,
        logoUrl: true,
        rateLimits: true,
        active: true,
      },
    });
    return NextResponse.json({ platforms });
  } catch (err) {
    console.error("[GET /api/v1/social/platforms]", err);
    return NextResponse.json({ error: "Failed to fetch platforms" }, { status: 500 });
  }
});
