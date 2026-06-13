/**
 * /api/v1/blogs/[id]/faqs/[faqId]
 *
 * Admin API for a single blog FAQ.
 * PUT    — update
 * DELETE — remove
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

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
// PUT — update FAQ
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: blogId, faqId } = await params;
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

      const existing = await prisma.wehowareBlogFaq.findFirst({
        where: { id: faqId, blogId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "FAQ not found" },
          { status: 404 }
        );
      }

      const body = await request.json();
      const { question, answer, display_order, active } = body;

      const validation = validateFaqInput(question, answer);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const updated = await prisma.wehowareBlogFaq.update({
        where: { id: faqId },
        data: {
          question: question.trim(),
          answer: answer.trim(),
          displayOrder: Number.isInteger(display_order) ? display_order : existing.displayOrder,
          active: typeof active === "boolean" ? active : existing.active,
        },
      });

      return NextResponse.json({ faq: serialize(updated) });
    } catch (err) {
      console.error("[PUT /api/v1/blogs/[id]/faqs/[faqId]] error:", err);
      return NextResponse.json(
        { error: "Failed to update FAQ" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE — remove FAQ
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: blogId, faqId } = await params;
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

      const existing = await prisma.wehowareBlogFaq.findFirst({
        where: { id: faqId, blogId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "FAQ not found" },
          { status: 404 }
        );
      }

      await prisma.wehowareBlogFaq.delete({ where: { id: faqId } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/blogs/[id]/faqs/[faqId]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete FAQ" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
