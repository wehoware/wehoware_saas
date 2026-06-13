/**
 * /api/v1/blogs/[id]/faqs
 *
 * Admin API for managing FAQs attached to a blog post.
 * GET  — list FAQs for the blog
 * POST — create a new FAQ
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const MAX_FAQS_PER_BLOG = 50;
const MAX_QUESTION_LENGTH = 500;
const MAX_ANSWER_LENGTH = 5000;

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serialize(faq) {
  return {
    id: faq.id,
    client_id: faq.clientId,
    blog_id: faq.blogId,
    question: faq.question,
    answer: faq.answer,
    display_order: faq.displayOrder,
    active: faq.active,
    created_at: faq.createdAt,
    updated_at: faq.updatedAt,
  };
}

function validateFaqInput(question, answer) {
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return { valid: false, error: "Question is required" };
  }
  if (question.trim().length > MAX_QUESTION_LENGTH) {
    return { valid: false, error: `Question must not exceed ${MAX_QUESTION_LENGTH} characters` };
  }
  if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
    return { valid: false, error: "Answer is required" };
  }
  if (answer.trim().length > MAX_ANSWER_LENGTH) {
    return { valid: false, error: `Answer must not exceed ${MAX_ANSWER_LENGTH} characters` };
  }
  return { valid: true };
}

// -------------------------------------------------------------------
// GET — list FAQs
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: blogId } = await params;
      const clientId = resolveClientId(user);

      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const blog = await prisma.wehowareBlog.findFirst({
        where: { id: blogId, clientId },
        select: { id: true },
      });
      if (!blog) {
        return NextResponse.json(
          { error: "Blog not found or not accessible" },
          { status: 404 }
        );
      }

      const faqs = await prisma.wehowareBlogFaq.findMany({
        where: { blogId },
        orderBy: { displayOrder: "asc" },
      });

      return NextResponse.json({ faqs: faqs.map(serialize) });
    } catch (err) {
      console.error("[GET /api/v1/blogs/[id]/faqs] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch FAQs" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST — create FAQ
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: blogId } = await params;
      const clientId = resolveClientId(user);

      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const blog = await prisma.wehowareBlog.findFirst({
        where: { id: blogId, clientId },
        select: { id: true },
      });
      if (!blog) {
        return NextResponse.json(
          { error: "Blog not found or not accessible" },
          { status: 404 }
        );
      }

      const count = await prisma.wehowareBlogFaq.count({ where: { blogId } });
      if (count >= MAX_FAQS_PER_BLOG) {
        return NextResponse.json(
          { error: `Maximum ${MAX_FAQS_PER_BLOG} FAQs allowed per blog` },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { question, answer, active = true } = body;

      const validation = validateFaqInput(question, answer);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const maxOrder = await prisma.wehowareBlogFaq.findFirst({
        where: { blogId },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      });

      const faq = await prisma.wehowareBlogFaq.create({
        data: {
          clientId,
          blogId,
          question: question.trim(),
          answer: answer.trim(),
          displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
          active: Boolean(active),
        },
      });

      return NextResponse.json({ faq: serialize(faq) }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/blogs/[id]/faqs] error:", err);
      return NextResponse.json(
        { error: "Failed to create FAQ" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
