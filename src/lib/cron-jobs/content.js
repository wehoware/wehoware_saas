/**
 * src/lib/cron-jobs/content.js
 *
 * Content scheduled-publish cron jobs.
 *
 * publishScheduledBlogs   — publishes blogs where scheduledPublishAt <= now() and status = Draft
 * publishScheduledServices — activates services where scheduledPublishAt <= now() and active = false
 *
 * Invocation: call these from an external scheduler (OS cron, Vercel Cron, etc.)
 * or expose them via a protected API route.
 */
import { prisma } from "@/lib/prisma";

export async function publishScheduledBlogs() {
  const now = new Date();
  const blogs = await prisma.wehowareBlog.findMany({
    where: {
      status: "Draft",
      scheduledPublishAt: { not: null, lte: now },
    },
    select: { id: true, publishedAt: true },
  });

  if (blogs.length === 0) return { published: 0 };

  const result = await prisma.wehowareBlog.updateMany({
    where: { id: { in: blogs.map((b) => b.id) } },
    data: {
      status: "Published",
      scheduledPublishAt: null,
    },
  });

  // Stamp publishedAt only on rows that don't have it yet
  const needsTimestamp = blogs.filter((b) => !b.publishedAt);
  if (needsTimestamp.length > 0) {
    await prisma.wehowareBlog.updateMany({
      where: { id: { in: needsTimestamp.map((b) => b.id) } },
      data: { publishedAt: now },
    });
  }

  console.log(`[content-cron] Published ${result.count} scheduled blog(s)`);
  return { published: result.count };
}

export async function publishScheduledServices() {
  const now = new Date();
  const services = await prisma.wehowareService.findMany({
    where: {
      active: false,
      scheduledPublishAt: { not: null, lte: now },
    },
    select: { id: true },
  });

  if (services.length === 0) return { activated: 0 };

  const result = await prisma.wehowareService.updateMany({
    where: { id: { in: services.map((s) => s.id) } },
    data: {
      active: true,
      scheduledPublishAt: null,
    },
  });

  console.log(`[content-cron] Activated ${result.count} scheduled service(s)`);
  return { activated: result.count };
}
