/**
 * src/lib/storage.js
 *
 * Replaces the old Supabase Storage wrapper (src/lib/storageUtils.js) with
 * a pluggable backend:
 *
 *   - Default: LOCAL filesystem storage at `public/uploads/<entityType>/<uuid>.<ext>`
 *              Served by Next.js at /uploads/<entityType>/<uuid>.<ext>
 *   - Optional: AWS S3 (enabled when all four AWS_* env vars are present)
 *
 * Public API (same names the old util used, so call sites can be updated
 * mechanically):
 *
 *   uploadThumbnail(file, entityType)        -> Promise<string publicUrl>
 *   deleteThumbnailByUrl(url)                -> Promise<void>
 *   deleteThumbnailByPath(path)              -> Promise<void>
 *   getPathFromPublicUrl(url)                -> string | null
 *
 * Server-only — do NOT import from client components.
 * Client components should upload via POST /api/v1/uploads instead.
 */

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT_RELATIVE = "public/uploads";
const PUBLIC_URL_PREFIX = "/uploads";
const VALID_ENTITY_TYPES = new Set([
  "services",
  "blogs",
  "general",
  "avatars",
  "invoices",
  "inventory",
]);

// ----------------------------------------------------------------
// S3 config (optional — we only use S3 if all four are set)
// ----------------------------------------------------------------
const S3_REGION = process.env.AWS_REGION;
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME;
const S3_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const S3_KEY_SECRET = process.env.AWS_SECRET_ACCESS_KEY;
const S3_CDN_URL = process.env.AWS_S3_CDN_URL; // optional
const USE_S3 = Boolean(S3_REGION && S3_BUCKET && S3_KEY_ID && S3_KEY_SECRET);

// Lazy-load the AWS SDK only if S3 is configured, so builds don't require the
// dependency when using local storage. Webpack can't resolve a bare
// `await import("@aws-sdk/client-s3")` without the dep being installed, so
// we go through an opaque loader function that the bundler treats as an
// opaque runtime dependency.
let _s3Client = null;
let _awsModule = null;
async function loadAwsModule() {
  if (_awsModule) return _awsModule;
  // Use Function() to hide the import from webpack's static analysis so the
  // package is only a runtime requirement (installed on prod hosts that use S3).
  const importer = new Function("m", "return import(m)");
  _awsModule = await importer("@aws-sdk/client-s3");
  return _awsModule;
}

async function getS3Client() {
  if (!USE_S3) return null;
  if (_s3Client) return _s3Client;
  const { S3Client } = await loadAwsModule();
  _s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_KEY_ID,
      secretAccessKey: S3_KEY_SECRET,
    },
  });
  return _s3Client;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function sanitizeEntityType(entityType) {
  const t = String(entityType ?? "").toLowerCase();
  return VALID_ENTITY_TYPES.has(t) ? t : "general";
}

function getExtension(fileName) {
  if (!fileName || typeof fileName !== "string") return "bin";
  const parts = fileName.split(".");
  if (parts.length < 2) return "bin";
  const ext = parts.pop().toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "bin";
}

function makeKey(entityType, originalName) {
  const type = sanitizeEntityType(entityType);
  const ext = getExtension(originalName);
  const uuid = randomUUID();
  return `${type}/${uuid}.${ext}`;
}

// ----------------------------------------------------------------
// Upload
// ----------------------------------------------------------------
/**
 * Upload a File/Blob to storage.
 *
 * @param {File|Blob}  file       - the incoming file (must have arrayBuffer())
 * @param {string}     entityType - 'services' | 'blogs' | 'avatars' | 'general'
 * @returns {Promise<string>} publicly-accessible URL
 */
export async function uploadThumbnail(file, entityType = "general") {
  if (!file) throw new Error("No file provided for upload");
  if (typeof file.arrayBuffer !== "function") {
    throw new Error("Invalid file object: missing arrayBuffer()");
  }

  const originalName = file.name || "upload";
  const key = makeKey(entityType, originalName);
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  if (USE_S3) {
    const { PutObjectCommand } = await loadAwsModule();
    const s3 = await getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    // Use CDN URL if provided, else standard S3 virtual-hosted URL
    return S3_CDN_URL
      ? `${S3_CDN_URL.replace(/\/$/, "")}/${key}`
      : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  }

  // Local filesystem
  const absDir = path.join(process.cwd(), STORAGE_ROOT_RELATIVE, path.dirname(key));
  await mkdir(absDir, { recursive: true });
  const absPath = path.join(process.cwd(), STORAGE_ROOT_RELATIVE, key);
  await writeFile(absPath, buffer);
  return `${PUBLIC_URL_PREFIX}/${key}`;
}

// ----------------------------------------------------------------
// Delete
// ----------------------------------------------------------------
export function getPathFromPublicUrl(url) {
  if (!url || typeof url !== "string") return null;

  // Local: /uploads/<type>/<file>
  if (url.startsWith(PUBLIC_URL_PREFIX + "/")) {
    return url.slice(PUBLIC_URL_PREFIX.length + 1);
  }

  // S3 CDN: <CDN>/<key>
  if (S3_CDN_URL && url.startsWith(S3_CDN_URL)) {
    return url.slice(S3_CDN_URL.replace(/\/$/, "").length + 1);
  }

  // S3 direct: https://<bucket>.s3.<region>.amazonaws.com/<key>
  if (USE_S3) {
    try {
      const u = new URL(url);
      const bucketHost = `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
      if (u.hostname === bucketHost) {
        return u.pathname.replace(/^\//, "");
      }
    } catch {
      // not a valid URL — fall through
    }
  }

  return null;
}

/**
 * Delete a previously-uploaded file by its public URL. Silently ignores
 * unknown/legacy URLs (e.g. old Supabase Storage links from the pre-migration
 * database) so a stale URL can't block a write.
 */
export async function deleteThumbnailByUrl(url) {
  const key = getPathFromPublicUrl(url);
  if (!key) return;
  await deleteThumbnailByPath(key);
}

export async function deleteThumbnailByPath(key) {
  if (!key || typeof key !== "string") return;

  if (USE_S3) {
    const { DeleteObjectCommand } = await loadAwsModule();
    const s3 = await getS3Client();
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (err) {
      // Non-fatal: log and continue. We don't want a storage hiccup to block
      // a DB record update.
      console.warn(`[storage] S3 delete failed for ${key}:`, err?.message);
    }
    return;
  }

  const absPath = path.join(process.cwd(), STORAGE_ROOT_RELATIVE, key);
  try {
    await unlink(absPath);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.warn(`[storage] local delete failed for ${key}:`, err?.message);
    }
  }
}
