import { prisma } from "../src/lib/prisma.js";

/**
 * Backfill canonical_url for existing blogs, services, and inventory items.
 * Generates https://{client.domain}/blog/{slug}  for blogs
 * and https://{client.domain}/services/{slug} for services
 * and https://{client.domain}/inventory/{slug} for inventory items
 * where canonical_url is currently null or empty.
 */
try {
  const clients = await prisma.wehowareClient.findMany({
    where: { domain: { not: null } },
    select: { id: true, domain: true, companyName: true },
  });

  let blogCount = 0;
  let serviceCount = 0;
  let inventoryCount = 0;

  for (const client of clients) {
    const base = `https://${client.domain}`;

    // Blogs
    const blogs = await prisma.wehowareBlog.findMany({
      where: {
        clientId: client.id,
        OR: [{ canonicalUrl: null }, { canonicalUrl: "" }],
      },
      select: { id: true, slug: true },
    });
    for (const blog of blogs) {
      await prisma.wehowareBlog.update({
        where: { id: blog.id },
        data: { canonicalUrl: `${base}/blog/${blog.slug}` },
      });
      blogCount++;
    }

    // Services
    const services = await prisma.wehowareService.findMany({
      where: {
        clientId: client.id,
        OR: [{ canonicalUrl: null }, { canonicalUrl: "" }],
      },
      select: { id: true, slug: true },
    });
    for (const service of services) {
      await prisma.wehowareService.update({
        where: { id: service.id },
        data: { canonicalUrl: `${base}/services/${service.slug}` },
      });
      serviceCount++;
    }

    // Inventory
    const items = await prisma.wehowareInventoryItem.findMany({
      where: {
        clientId: client.id,
        OR: [{ canonicalUrl: null }, { canonicalUrl: "" }],
      },
      select: { id: true, slug: true },
    });
    for (const item of items) {
      await prisma.wehowareInventoryItem.update({
        where: { id: item.id },
        data: { canonicalUrl: `${base}/inventory/${item.slug}` },
      });
      inventoryCount++;
    }

    console.log(`  ${client.companyName} (${client.domain}): ${blogs.length} blogs, ${services.length} services, ${items.length} inventory items`);
  }

  console.log(`\nBackfilled ${blogCount} blogs, ${serviceCount} services, and ${inventoryCount} inventory items with canonical URLs.`);
} catch (e) {
  console.error("Backfill failed:", e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
