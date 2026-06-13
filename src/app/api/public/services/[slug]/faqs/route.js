/**
 * GET /api/public/services/[slug]/faqs
 *
 * Public API for fetching active FAQs for a service.
 * No authentication required.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function resolveClient(domain, clientId) {
  if (!domain && !clientId) return null;
  const where = {};
  if (domain) where.domain = domain;
  if (clientId) where.id = clientId;
  const client = await prisma.wehowareClient.findFirst({
    where,
    select: { id: true, active: true },
  });
  if (!client) return null;
  if (!client.active) return { inactive: true, id: client.id };
  return client;
}

function serialize(faq) {
  return {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    display_order: faq.displayOrder,
  };
}

function buildFaqSchema(faqs) {
  if (!faqs || faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
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

    const service = await prisma.wehowareService.findFirst({
      where: { clientId: client.id, slug, active: true },
      select: { id: true },
    });
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const faqs = await prisma.wehowareServiceFaq.findMany({
      where: { serviceId: service.id, active: true },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({
      faqs: faqs.map(serialize),
      faq_schema: buildFaqSchema(faqs),
    });
  } catch (err) {
    console.error("[GET /api/public/services/[slug]/faqs] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch FAQs" },
      { status: 500 }
    );
  }
}
