/**
 * Browser: upload a file via /api/upload (MinIO by default, Cloudinary fallback).
 * Used by Planning attachments and rich-text image insertion.
 */
export async function uploadFileViaApi(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
  }
  if (!data.url) throw new Error("No file URL returned");
  return { url: data.url };
}
