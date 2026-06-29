/**
 * /api/v1/inventory/settings
 *
 * GET — fetch inventory settings for the active client
 * PUT — update inventory settings (admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(s) {
  return {
    id: s.id,
    client_id: s.clientId,
    default_currency: s.defaultCurrency,
    low_stock_threshold: s.lowStockThreshold,
    auto_archive_days: s.autoArchiveDays,
    enable_stock_tracking: s.enableStockTracking,
    enable_low_stock_alerts: s.enableLowStockAlerts,
    enable_public_listing: s.enablePublicListing,
    enable_inquiries: s.enableInquiries,
    enable_test_drive: s.enableTestDrive,
    default_item_type: s.defaultItemType,
    listing_page_title: s.listingPageTitle,
    listing_page_description: s.listingPageDescription,
    contact_email: s.contactEmail,
    contact_phone: s.contactPhone,
    business_hours: s.businessHours,
    address: s.address,
    social_facebook: s.socialFacebook,
    social_instagram: s.socialInstagram,
    social_twitter: s.socialTwitter,
    social_youtube: s.socialYoutube,
    seo_title: s.seoTitle,
    seo_description: s.seoDescription,
    seo_keywords: s.seoKeywords,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    let settings = await prisma.wehowareInventorySetting.findUnique({ where: { clientId } });
    if (!settings) {
      settings = await prisma.wehowareInventorySetting.create({ data: { clientId } });
    }
    return NextResponse.json({ settings: serialize(settings) });
  } catch (err) {
    console.error("[GET /api/v1/inventory/settings]", err);
    return NextResponse.json({ error: "Failed to fetch inventory settings" }, { status: 500 });
  }
}, { allowedRoles: ["client", "employee", "admin"] });

export const PUT = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const clientId = resolveClientId(user);
    if (!clientId) return NextResponse.json({ error: "Active client context required" }, { status: 400 });

    const body = await request.json();
    const data = {};
    const fieldMap = {
      default_currency: "defaultCurrency",
      low_stock_threshold: "lowStockThreshold",
      auto_archive_days: "autoArchiveDays",
      enable_stock_tracking: "enableStockTracking",
      enable_low_stock_alerts: "enableLowStockAlerts",
      enable_public_listing: "enablePublicListing",
      enable_inquiries: "enableInquiries",
      enable_test_drive: "enableTestDrive",
      default_item_type: "defaultItemType",
      listing_page_title: "listingPageTitle",
      listing_page_description: "listingPageDescription",
      contact_email: "contactEmail",
      contact_phone: "contactPhone",
      business_hours: "businessHours",
      address: "address",
      social_facebook: "socialFacebook",
      social_instagram: "socialInstagram",
      social_twitter: "socialTwitter",
      social_youtube: "socialYoutube",
      seo_title: "seoTitle",
      seo_description: "seoDescription",
      seo_keywords: "seoKeywords",
    };

    for (const [snakeKey, prismaKey] of Object.entries(fieldMap)) {
      if (body[snakeKey] !== undefined) {
        const val = body[snakeKey];
        if (typeof val === "boolean") {
          data[prismaKey] = val;
        } else if (typeof val === "number") {
          data[prismaKey] = val;
        } else {
          data[prismaKey] = val || null;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    let settings = await prisma.wehowareInventorySetting.findUnique({ where: { clientId } });
    if (!settings) {
      settings = await prisma.wehowareInventorySetting.create({
        data: { clientId, ...data },
      });
    } else {
      settings = await prisma.wehowareInventorySetting.update({
        where: { clientId },
        data,
      });
    }

    return NextResponse.json({ settings: serialize(settings) });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    console.error("[PUT /api/v1/inventory/settings]", err);
    return NextResponse.json({ error: "Failed to update inventory settings" }, { status: 500 });
  }
}, { allowedRoles: ["admin"] });
