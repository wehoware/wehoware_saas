/**
 * Shared SEO schema builders and client resolver for public API endpoints.
 *
 * All Schema.org JSON-LD builders are centralized here to:
 *   - Eliminate duplication across 12+ route files
 *   - Ensure consistent schema structure across blogs, services, inventory
 *   - Make it trivial to add new schema types or enrich existing ones
 *
 * Usage:
 *   import { resolveClient, buildBlogSchema, buildItemListSchema } from "@/lib/public-seo";
 */

import { prisma } from "@/lib/prisma";

const SCHEMA_CONTEXT = "https://schema.org";

/**
 * Fields selected from WehowareClient for schema generation.
 * Used by all schema builders that embed Organization data.
 */
const CLIENT_SELECT = {
  id: true,
  active: true,
  companyName: true,
  website: true,
  domain: true,
  address: true,
  email: true,
  contactNumber: true,
};

/**
 * Resolve a client by domain or clientId.
 * Returns null if not found, or { inactive: true, id } if inactive.
 *
 * @param {string|null} domain
 * @param {string|null} clientId
 * @returns {Promise<object|null>}
 */
export async function resolveClient(domain, clientId) {
  if (!domain && !clientId) return null;

  const where = {};
  if (domain) where.domain = domain;
  if (clientId) where.id = clientId;

  const client = await prisma.wehowareClient.findFirst({
    where,
    select: CLIENT_SELECT,
  });

  if (!client) return null;
  if (!client.active) return { inactive: true, id: client.id };
  return client;
}

/**
 * Build an Organization schema.org object from client data.
 *
 * @param {object} client - WehowareClient with companyName, website, domain, address, email, contactNumber
 * @returns {object|null}
 */
export function buildOrganizationSchema(client) {
  if (!client) return null;

  const org = {
    "@type": "Organization",
    name: client.companyName,
  };

  if (client.website) {
    org.url = client.website;
  } else if (client.domain) {
    org.url = `https://${client.domain}`;
  }

  if (client.email) {
    org.email = client.email;
  }

  if (client.contactNumber) {
    org.telephone = client.contactNumber;
  }

  if (client.address) {
    org.address = {
      "@type": "PostalAddress",
      streetAddress: client.address,
    };
  }

  return org;
}

/**
 * Build a FAQPage schema.org object from FAQ records.
 * Filters to active FAQs and sorts by displayOrder.
 *
 * @param {array} faqs - Array of FAQ records with question, answer, active, displayOrder
 * @returns {object|null}
 */
export function buildFaqSchema(faqs) {
  if (!faqs || faqs.length === 0) return null;

  const activeFaqs = faqs
    .filter((f) => f.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (activeFaqs.length === 0) return null;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: activeFaqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

/**
 * Build a BlogPosting schema.org object.
 *
 * @param {object} blog - WehowareBlog record
 * @param {object} client - WehowareClient record
 * @returns {object}
 */
export function buildBlogSchema(blog, client) {
  const schema = {
    "@context": SCHEMA_CONTEXT,
    "@type": blog.schemaType || "BlogPosting",
    headline: blog.title,
    description: blog.metaDescription || blog.excerpt || "",
  };

  if (blog.thumbnail || blog.openGraphImage) {
    schema.image = blog.thumbnail || blog.openGraphImage;
  }

  if (blog.publishedAt) {
    schema.datePublished = blog.publishedAt.toISOString();
  }

  if (blog.updatedAt) {
    schema.dateModified = blog.updatedAt.toISOString();
  }

  if (client) {
    const org = buildOrganizationSchema(client);
    if (org) {
      schema.author = org;
      schema.publisher = org;
    }
  }

  if (blog.canonicalUrl) {
    schema.mainEntityOfPage = {
      "@type": "WebPage",
      "@id": blog.canonicalUrl,
    };
  }

  if (blog.metaKeywords) {
    schema.keywords = blog.metaKeywords;
  }

  if (blog.content) {
    schema.wordCount = blog.content.replace(/<[^>]*>/g, "").trim().split(/\s+/).length;
  }

  if (blog.category && blog.category.name) {
    schema.articleSection = blog.category.name;
  }

  return schema;
}

/**
 * Build a Service schema.org object.
 *
 * @param {object} service - WehowareService record
 * @param {object} client - WehowareClient record
 * @returns {object}
 */
export function buildServiceSchema(service, client) {
  const schema = {
    "@context": SCHEMA_CONTEXT,
    "@type": service.schemaType || "Service",
    name: service.title,
    description: service.metaDescription || service.description || "",
  };

  if (service.thumbnail || service.openGraphImage) {
    schema.image = service.thumbnail || service.openGraphImage;
  }

  if (client) {
    const org = buildOrganizationSchema(client);
    if (org) {
      schema.provider = org;
    }
  }

  if (service.fee && Number(service.fee) > 0) {
    schema.offers = {
      "@type": "Offer",
      price: Number(service.fee),
      priceCurrency: service.feeCurrency || "CAD",
    };
  }

  if (service.metaKeywords) {
    schema.keywords = service.metaKeywords;
  }

  if (service.category && service.category.name) {
    schema.serviceType = service.category.name;
  }

  if (client && client.domain) {
    schema.areaServed = {
      "@type": "Place",
      url: `https://${client.domain}`,
    };
  }

  if (service.rating && Number(service.rating) > 0 && service.reviewsCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(service.rating),
      reviewCount: service.reviewsCount,
    };
  }

  return schema;
}

/**
 * Build a Product or Vehicle schema.org object for inventory items.
 *
 * @param {object} item - WehowareInventoryItem record
 * @param {object} client - WehowareClient record
 * @returns {object}
 */
export function buildProductSchema(item, client) {
  const schema = {
    "@context": SCHEMA_CONTEXT,
    "@type": item.schemaType || (item.type === "vehicle" ? "Vehicle" : "Product"),
    name: item.title,
    description: item.metaDescription || item.description || "",
  };

  if (item.thumbnail) {
    schema.image = item.thumbnail;
  }

  if (client) {
    const org = buildOrganizationSchema(client);
    if (org) {
      schema.brand = {
        "@type": "Brand",
        name: org.name,
      };
    }
  }

  if (item.sku) {
    schema.sku = item.sku;
  }

  if (item.category && item.category.name) {
    schema.category = item.category.name;
  }

  if (item.priceVisible && item.price && Number(item.price) > 0) {
    schema.offers = {
      "@type": "Offer",
      price: Number(item.price),
      priceCurrency: item.currency || "CAD",
    };
  }

  if (item.metaKeywords) {
    schema.keywords = item.metaKeywords;
  }

  const statusMap = {
    in_stock: "https://schema.org/InStock",
    active: "https://schema.org/InStock",
    low_stock: "https://schema.org/LimitedAvailability",
    out_of_stock: "https://schema.org/OutOfStock",
    sold: "https://schema.org/SoldOut",
    reserved: "https://schema.org/PreOrder",
    archived: "https://schema.org/Discontinued",
  };

  if (statusMap[item.status]) {
    if (schema.offers) {
      schema.offers.availability = statusMap[item.status];
    } else {
      schema.offers = {
        "@type": "Offer",
        availability: statusMap[item.status],
      };
    }
  }

  if (item.attributes && typeof item.attributes === "object") {
    if (item.attributes.make) schema.vehicleConfiguration = item.attributes.make;
    if (item.attributes.model) schema.model = item.attributes.model;
    if (item.attributes.year) schema.vehicleModelDate = String(item.attributes.year);
    if (item.attributes.vin) schema.vehicleIdentificationNumber = item.attributes.vin;
    if (item.attributes.mileage) schema.mileageFromOdometer = item.attributes.mileage;
    if (item.attributes.condition) {
      const conditionMap = {
        new: "https://schema.org/NewCondition",
        used: "https://schema.org/UsedCondition",
        refurbished: "https://schema.org/RefurbishedCondition",
        damaged: "https://schema.org/DamagedCondition",
      };
      const condKey = String(item.attributes.condition).toLowerCase();
      if (conditionMap[condKey]) {
        schema.itemCondition = conditionMap[condKey];
      }
    }
  }

  if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    const allImages = [item.thumbnail, ...item.images].filter(Boolean);
    if (allImages.length > 1) {
      schema.image = allImages;
    }
  }

  return schema;
}

/**
 * Build an ItemList schema.org object for list endpoints.
 *
 * @param {array} items - Array of serialized items with at least { slug, title, canonical_url }
 * @param {string} baseUrl - Base URL for constructing item URLs (e.g. "https://example.com/blogs")
 * @returns {object}
 */
export function buildItemListSchema(items, baseUrl) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    itemListElement: (items || []).map((item, index) => {
      const itemUrl = item.canonical_url || `${baseUrl}/${item.slug}`;
      return {
        "@type": "ListItem",
        position: index + 1,
        url: itemUrl,
        name: item.title,
      };
    }),
  };
}

/**
 * Build a CollectionPage schema.org object for list endpoints.
 *
 * @param {string} name - Page title (e.g. "Blog Posts")
 * @param {string} description - Page description
 * @param {string} url - Canonical URL of the collection page
 * @returns {object}
 */
export function buildCollectionPageSchema(name, description, url) {
  const schema = {
    "@context": SCHEMA_CONTEXT,
    "@type": "CollectionPage",
    name: name,
  };

  if (description) {
    schema.description = description;
  }

  if (url) {
    schema.url = url;
  }

  return schema;
}

/**
 * Build a BreadcrumbList schema.org object for detail pages.
 *
 * @param {array} trail - Array of { name, url } objects from root to leaf
 * @returns {object}
 */
export function buildBreadcrumbSchema(trail) {
  if (!trail || trail.length === 0) return null;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
