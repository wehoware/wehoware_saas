// tests/mocks/storage.mjs — stub for S3-backed helpers.
export async function deleteThumbnailByUrl() {
  return { success: true };
}
export async function uploadFile() {
  return { url: "mock://file" };
}
