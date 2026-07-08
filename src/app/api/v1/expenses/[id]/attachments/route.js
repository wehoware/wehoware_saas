/**
 * /api/v1/expenses/[id]/attachments
 *
 * GET    — list attachments for an expense
 * POST   — multipart upload + create attachment record atomically
 * DELETE — delete attachment record + physical file from storage
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";
import {
  uploadThumbnail,
  deleteThumbnailByUrl,
} from "@/lib/storage";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeAttachment(a) {
  return {
    id: a.id,
    file_name: a.fileName,
    file_url: a.fileUrl,
    file_type: a.fileType,
    file_size: a.fileSize,
    created_at: a.createdAt,
  };
}

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const expense = await prisma.wehowareExpense.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!expense) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 }
        );
      }

      const attachments = await prisma.wehowareAttachment.findMany({
        where: { expenseId: id, clientId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        data: attachments.map(serializeAttachment),
      });
    } catch (err) {
      console.error("[GET /api/v1/expenses/[id]/attachments] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch attachments" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const expense = await prisma.wehowareExpense.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!expense) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 }
        );
      }

      let form;
      try {
        form = await request.formData();
      } catch {
        return NextResponse.json(
          { error: "Invalid multipart form data" },
          { status: 400 }
        );
      }

      const file = form.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json(
          { error: "Missing 'file' field" },
          { status: 400 }
        );
      }

      if (typeof file.size === "number" && file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)` },
          { status: 413 }
        );
      }

      if (typeof file.size === "number" && file.size === 0) {
        return NextResponse.json(
          { error: "File is empty" },
          { status: 400 }
        );
      }

      const mime = String(file.type || "");
      const mimeOk = ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
      if (!mimeOk) {
        return NextResponse.json(
          { error: "Only images and PDFs are allowed" },
          { status: 415 }
        );
      }

      let fileUrl;
      try {
        fileUrl = await uploadThumbnail(file, "expenses");
      } catch (err) {
        console.error("[POST /api/v1/expenses/[id]/attachments] upload error:", err);
        return NextResponse.json(
          { error: "File upload failed" },
          { status: 500 }
        );
      }

      let attachment;
      try {
        attachment = await prisma.wehowareAttachment.create({
          data: {
            clientId,
            expenseId: id,
            fileName: file.name || "unnamed",
            fileUrl,
            fileType: mime,
            fileSize: typeof file.size === "number" ? file.size : 0,
          },
        });
      } catch (err) {
        console.error("[POST /api/v1/expenses/[id]/attachments] DB error:", err);
        await deleteThumbnailByUrl(fileUrl).catch(() => {});
        return NextResponse.json(
          { error: "Failed to save attachment record" },
          { status: 500 }
        );
      }

      return NextResponse.json(serializeAttachment(attachment), {
        status: 201,
      });
    } catch (err) {
      console.error("[POST /api/v1/expenses/[id]/attachments] error:", err);
      return NextResponse.json(
        { error: "Failed to upload attachment" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);

export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }

      const attachmentId = body?.id;
      if (!attachmentId || typeof attachmentId !== "string") {
        return NextResponse.json(
          { error: "Missing 'id' field" },
          { status: 400 }
        );
      }

      const attachment = await prisma.wehowareAttachment.findFirst({
        where: { id: attachmentId, expenseId: id, clientId },
      });
      if (!attachment) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      await deleteThumbnailByUrl(attachment.fileUrl).catch((err) => {
        console.warn("[DELETE /api/v1/expenses/[id]/attachments] file cleanup failed:", err?.message);
      });

      await prisma.wehowareAttachment.delete({ where: { id: attachmentId } });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/expenses/[id]/attachments] error:", err);
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
