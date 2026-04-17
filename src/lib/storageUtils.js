/**
 * src/lib/storageUtils.js
 *
 * Compatibility shim — the original Supabase-backed storage util has been
 * replaced by a server-side storage layer (src/lib/storage.js) and a
 * secure /api/v1/uploads route. This file re-exports the browser-safe
 * client helpers so existing admin pages keep working without changes.
 *
 * Prefer importing from "@/lib/uploadClient" in new code.
 */

export {
  uploadThumbnail,
  deleteThumbnailByUrl,
} from "./uploadClient";

// Legacy function name used by a couple of call sites. Kept for
// compatibility; the new client helper doesn't need a path variant because
// deletion is handled server-side given a URL.
export async function deleteThumbnailByPath(/* _path */) {
  // No-op: deletion now goes through deleteThumbnailByUrl which gives the
  // server enough context to locate the object.
  return;
}

// Legacy helper — returns null for any URL now; the server extracts the
// path itself. Call sites that used this only to decide whether to call
// delete should just call deleteThumbnailByUrl — it handles unknown URLs.
export function getPathFromSupabaseUrl(/* _url */) {
  return null;
}
