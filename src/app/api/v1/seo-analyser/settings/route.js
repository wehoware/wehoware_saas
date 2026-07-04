import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { prisma } from "@/lib/prisma";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

const DEFAULT_SETTINGS = {
  enabled: true,
  scanBlogs: true,
  scanServices: true,
  scanInventory: false,
  scheduleFrequency: "weekly",
  scheduleHour: 3,
  autoSuggestFixes: true,
  checkMetaTags: true,
  checkOpenGraph: true,
  checkTwitterCards: true,
  checkCanonical: true,
  checkRobotsMeta: true,
  checkHeadingStructure: true,
  checkImageAlt: true,
  checkContentStructure: true,
  checkKeywordUsage: true,
  checkEeat: true,
  checkReadability: true,
  checkContentFreshness: true,
  checkUrlOptimization: true,
  checkIndexability: true,
  checkHttps: true,
  checkWebVitals: true,
  checkRichSnippets: true,
  checkSerpFeatures: true,
  checkMultimediaSeo: true,
  checkInternalLinks: true,
  checkSchema: true,
  checkTfidf: true,
  checkDuplicateContent: true,
  checkAeo: true,
  checkGeo: true,
  checkSxo: true,
};

/**
 * GET /api/v1/seo-analyser/settings
 *   Returns the analyser settings for the current client.
 */
export const GET = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  let settings = await prisma.wehowareSeoAnalyserSetting.findUnique({
    where: { clientId },
  });

  if (!settings) {
    settings = await prisma.wehowareSeoAnalyserSetting.create({
      data: { clientId, ...DEFAULT_SETTINGS },
    });
  }

  return NextResponse.json({ data: settings });
});

/**
 * PUT /api/v1/seo-analyser/settings
 *   Updates the analyser settings for the current client.
 *   Body: partial settings object
 */
export const PUT = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const body = await request.json();

  // Ensure settings row exists
  let settings = await prisma.wehowareSeoAnalyserSetting.findUnique({
    where: { clientId },
  });
  if (!settings) {
    settings = await prisma.wehowareSeoAnalyserSetting.create({
      data: { clientId, ...DEFAULT_SETTINGS },
    });
  }

  // Update with provided fields
  const allowedFields = [
    "enabled", "scanBlogs", "scanServices", "scanInventory",
    "scheduleFrequency", "scheduleHour", "autoSuggestFixes",
    "checkMetaTags", "checkOpenGraph", "checkTwitterCards",
    "checkCanonical", "checkRobotsMeta", "checkHeadingStructure",
    "checkImageAlt", "checkContentStructure", "checkKeywordUsage",
    "checkEeat", "checkReadability", "checkContentFreshness",
    "checkUrlOptimization", "checkIndexability", "checkHttps",
    "checkWebVitals", "checkRichSnippets", "checkSerpFeatures",
    "checkMultimediaSeo", "checkInternalLinks", "checkSchema",
    "checkTfidf", "checkDuplicateContent", "checkAeo", "checkGeo", "checkSxo",
  ];

  const updateData = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const updated = await prisma.wehowareSeoAnalyserSetting.update({
    where: { clientId },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
});
