/**
 * Content fetcher for the SEO analyser.
 *
 * Fetches content from the database by type (blog, service) and
 * normalizes it into a common shape for the LLM analyser.
 */

import { prisma } from "@/lib/prisma";
import { computeSeoScore } from "@/lib/seoScore";

const VALID_CONTENT_TYPES = new Set(["blog", "service"]);

/**
 * Validate that a content type is supported.
 * @param {string} type
 * @returns {boolean}
 */
export function isValidContentType(type) {
  return VALID_CONTENT_TYPES.has(type);
}

/**
 * Fetch a blog post by ID for a specific client.
 * @param {string} clientId
 * @param {string} contentId
 * @returns {Promise<Object|null>}
 */
async function fetchBlog(clientId, contentId) {
  const blog = await prisma.wehowareBlog.findFirst({
    where: { id: contentId, clientId },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      thumbnail: true,
      thumbnailAlt: true,
      status: true,
      tags: true,
      metaTitle: true,
      metaDescription: true,
      metaKeywords: true,
      openGraphTitle: true,
      openGraphDescription: true,
      openGraphImage: true,
      twitterTitle: true,
      twitterDescription: true,
      twitterImage: true,
      canonicalUrl: true,
      robotsMeta: true,
      schemaType: true,
      seoScore: true,
      targetKeywords: true,
    },
  });

  if (!blog) return null;

  return {
    id: blog.id,
    type: "blog",
    title: blog.title,
    slug: blog.slug,
    excerpt: blog.excerpt,
    content: blog.content,
    thumbnail: blog.thumbnail,
    thumbnailAlt: blog.thumbnailAlt,
    status: blog.status,
    tags: blog.tags,
    metaTitle: blog.metaTitle,
    metaDescription: blog.metaDescription,
    metaKeywords: blog.metaKeywords,
    openGraphTitle: blog.openGraphTitle,
    openGraphDescription: blog.openGraphDescription,
    openGraphImage: blog.openGraphImage,
    twitterTitle: blog.twitterTitle,
    twitterDescription: blog.twitterDescription,
    twitterImage: blog.twitterImage,
    canonicalUrl: blog.canonicalUrl,
    robotsMeta: blog.robotsMeta,
    schemaType: blog.schemaType,
    targetKeywords: blog.targetKeywords,
    seoScore: blog.seoScore,
  };
}

/**
 * Fetch a service by ID for a specific client.
 * @param {string} clientId
 * @param {string} contentId
 * @returns {Promise<Object|null>}
 */
async function fetchService(clientId, contentId) {
  const service = await prisma.wehowareService.findFirst({
    where: { id: contentId, clientId },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      content: true,
      thumbnail: true,
      thumbnailAlt: true,
      active: true,
      tags: true,
      fee: true,
      feeCurrency: true,
      duration: true,
      metaTitle: true,
      metaDescription: true,
      metaKeywords: true,
      openGraphTitle: true,
      openGraphDescription: true,
      openGraphImage: true,
      twitterTitle: true,
      twitterDescription: true,
      twitterImage: true,
      canonicalUrl: true,
      robotsMeta: true,
      schemaType: true,
      seoScore: true,
      targetKeywords: true,
    },
  });

  if (!service) return null;

  return {
    id: service.id,
    type: "service",
    title: service.title,
    slug: service.slug,
    excerpt: service.description,
    content: service.content,
    thumbnail: service.thumbnail,
    thumbnailAlt: service.thumbnailAlt,
    status: service.active ? "Published" : "Draft",
    tags: service.tags,
    fee: service.fee,
    feeCurrency: service.feeCurrency,
    duration: service.duration,
    metaTitle: service.metaTitle,
    metaDescription: service.metaDescription,
    metaKeywords: service.metaKeywords,
    openGraphTitle: service.openGraphTitle,
    openGraphDescription: service.openGraphDescription,
    openGraphImage: service.openGraphImage,
    twitterTitle: service.twitterTitle,
    twitterDescription: service.twitterDescription,
    twitterImage: service.twitterImage,
    canonicalUrl: service.canonicalUrl,
    robotsMeta: service.robotsMeta,
    schemaType: service.schemaType,
    targetKeywords: service.targetKeywords,
    seoScore: service.seoScore,
  };
}

const FETCHERS = {
  blog: fetchBlog,
  service: fetchService,
};

/**
 * Fetch content by type and ID for a client.
 * @param {string} clientId
 * @param {string} contentType
 * @param {string} contentId
 * @returns {Promise<Object|null>}
 */
export async function fetchContent(clientId, contentType, contentId) {
  const fetcher = FETCHERS[contentType];
  if (!fetcher) return null;
  return fetcher(clientId, contentId);
}

/**
 * Get the current SEO score for content.
 * @param {Object} content
 * @returns {number}
 */
export function getContentSeoScore(content) {
  if (!content) return 0;
  return computeSeoScore(content);
}

/**
 * List content items of a given type for a client (for the UI selector).
 * @param {string} clientId
 * @param {string} contentType
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function listContentItems(clientId, contentType, limit = 50) {
  if (contentType === "blog") {
    const blogs = await prisma.wehowareBlog.findMany({
      where: { clientId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        seoScore: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return blogs.map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      status: b.status,
      seoScore: b.seoScore,
      updatedAt: b.updatedAt,
    }));
  }

  if (contentType === "service") {
    const services = await prisma.wehowareService.findMany({
      where: { clientId },
      select: {
        id: true,
        title: true,
        slug: true,
        active: true,
        seoScore: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return services.map((s) => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
      status: s.active ? "Published" : "Draft",
      seoScore: s.seoScore,
      updatedAt: s.updatedAt,
    }));
  }

  return [];
}
