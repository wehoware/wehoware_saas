/**
 * GET /api/public/inventory/[slug]
 *
 * Fetch a single active inventory item by slug for a client.
 * Increments views atomically on each fetch.
 *
 * Usage:
 *   GET /api/public/inventory/2024-toyota-camry?domain=nawab-motors.com
 *   GET /api/public/inventory/2024-toyota-camry?clientId=uuid-here
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveClient,
  buildProductSchema,
  buildBreadcrumbSchema,
} from "@/lib/public-seo";

function serialize(item) {
  const price = item.price !== null && item.price !== undefined ? Number(item.price) : null;
  return {
    id: item.id,
    client_id: item.clientId,
    category_id: item.categoryId,
    title: item.title,
    slug: item.slug,
    type: item.type,
    sku: item.sku,
    description: item.description,
    content: item.content,
    thumbnail: item.thumbnail,
    thumbnail_alt: item.thumbnailAlt,
    price,
    currency: item.currency,
    price_visible: item.priceVisible,
    price_label: !item.priceVisible ? "Contact for pricing" : (!price || price === 0 ? "Free" : null),
    quantity: item.quantity,
    reorder_threshold: item.reorderThreshold,
    status: item.status,
    tags: item.tags,
    featured: item.featured,
    attributes: item.attributes,
    images: item.images,
    videos: item.videos,
    meta_title: item.metaTitle,
    meta_description: item.metaDescription,
    meta_keywords: item.metaKeywords,
    open_graph_title: item.openGraphTitle,
    open_graph_description: item.openGraphDescription,
    open_graph_image: item.openGraphImage,
    twitter_title: item.twitterTitle,
    twitter_description: item.twitterDescription,
    twitter_image: item.twitterImage,
    canonical_url: item.canonicalUrl,
    robots_meta: item.robotsMeta,
    schema_type: item.schemaType,
    seo_score: item.seoScore,
    target_keywords: item.targetKeywords,
    cta_heading: item.ctaHeading,
    cta_body: item.ctaBody,
    cta_button_text: item.ctaButtonText,
    cta_button_url: item.ctaButtonUrl,
    allow_social_share: item.allowSocialShare,
    views: item.views,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    category: item.category
      ? { id: item.category.id, name: item.category.name, slug: item.category.slug }
      : null,
  };
}

export async function GET(request, { params }) {
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

    const item = await prisma.wehowareInventoryItem.findFirst({
      where: { clientId: client.id, slug, active: true, status: { in: ["active", "in_stock", "low_stock"] } },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    // Increment views atomically (non-blocking)
    prisma.wehowareInventoryItem.update({
      where: { id: item.id },
      data: { views: { increment: 1 } },
    }).catch(() => {});

    const siteUrl = client.domain ? `https://${client.domain}` : "";
    const breadcrumbTrail = [
      { name: "Home", url: siteUrl || "/" },
    ];
    if (item.category && item.category.name) {
      breadcrumbTrail.push({
        name: item.category.name,
        url: siteUrl ? `${siteUrl}/inventory?categoryId=${item.category.id}` : `/inventory?categoryId=${item.category.id}`,
      });
    }
    breadcrumbTrail.push({
      name: item.title,
      url: item.canonicalUrl || (siteUrl ? `${siteUrl}/inventory/${item.slug}` : `/inventory/${item.slug}`),
    });

    return NextResponse.json({
      item: serialize(item),
      product_schema: buildProductSchema(item, client),
      breadcrumb_schema: buildBreadcrumbSchema(breadcrumbTrail),
    });
  } catch (err) {
    console.error("[GET /api/public/inventory/[slug]] error:", err);
    return NextResponse.json({ error: "Failed to fetch inventory item" }, { status: 500 });
  }
}
