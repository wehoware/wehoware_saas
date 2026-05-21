/**
 * POST /api/v1/uploads
 *
 * Accepts multipart/form-data with:
 *   - file        (File)         required
 *   - entityType  (string)       'blogs' | 'services' | 'avatars' | 'general'
 *
 * Returns: { url: string }
 *
 * DELETE /api/v1/uploads
 *   body: { url: string }
 *   Removes a previously-uploaded file. Silently ignores unknown URLs so
 *   stale client-side references never block a subsequent write.
 */

import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import {
  uploadThumbnail,
  deleteThumbnailByUrl,
} from "@/lib/storage";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — reject oversize uploads early
const ALLOWED_MIME_PREFIXES = ["image/"];
const ALLOWED_ENTITY_TYPES = new Set([
  "blogs",
  "services",
  "avatars",
  "general",
  "invoices",
]);

export const POST = withAuth(
  async (request) => {
    let form;
    try {
      form = await request.formData();
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid multipart form data" },
        { status: 400 }
      );
    }

    const file = form.get("file");
    const entityTypeRaw = form.get("entityType") ?? "general";

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Missing 'file' field" },
        { status: 400 }
      );
    }

    // Size guard
    if (typeof file.size === "number" && file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)` },
        { status: 413 }
      );
    }

    // MIME guard
    const mime = String(file.type || "");
    const mimeOk = ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
    if (!mimeOk) {
      return NextResponse.json(
        { error: "Only image uploads are allowed" },
        { status: 415 }
      );
    }

    // Entity type guard
    const entityType = String(entityTypeRaw);
    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json(
        {
          error: `Invalid entityType. Must be one of: ${[
            ...ALLOWED_ENTITY_TYPES,
          ].join(", ")}`,
        },
        { status: 400 }
      );
    }

    try {
      const url = await uploadThumbnail(file, entityType);
      return NextResponse.json({ url });
    } catch (err) {
      console.error("[uploads POST] error:", err);
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const DELETE = withAuth(
  async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const url = body?.url;
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing 'url' field" },
        { status: 400 }
      );
    }
    try {
      await deleteThumbnailByUrl(url);
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[uploads DELETE] error:", err);
      return NextResponse.json(
        { error: "Delete failed" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
