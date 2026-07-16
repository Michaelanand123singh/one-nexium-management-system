import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { isMinioConfigured, uploadToMinio } from "@/lib/storage";

/**
 * Initialise Cloudinary (optional fallback when MinIO is not configured).
 */
function initCloudinary(): boolean {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (match) {
      const [, apiKey, apiSecret, cloudName] = match;
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      return true;
    }
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    return true;
  }

  return false;
}

const cloudinaryReady = initCloudinary();

function resolveDriver(): "minio" | "cloudinary" | null {
  const forced = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (forced === "minio") return isMinioConfigured() ? "minio" : null;
  if (forced === "cloudinary") return cloudinaryReady ? "cloudinary" : null;
  // Default: prefer self-hosted MinIO, then Cloudinary.
  if (isMinioConfigured()) return "minio";
  if (cloudinaryReady) return "cloudinary";
  return null;
}

async function uploadViaCloudinary(
  buffer: Buffer,
  file: File,
  organisationId: string
): Promise<string> {
  const type = (file.type || "application/octet-stream").split("/")[0];
  const resourceType =
    type === "video" ? "video" : type === "image" ? "image" : "raw";

  const baseName = file.name ?? "upload";
  const ext = path.extname(baseName).replace(/[^a-zA-Z0-9.]/g, "") || ".bin";
  const tempPath = path.join(
    os.tmpdir(),
    `nexium-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
  );

  try {
    await fs.writeFile(tempPath, buffer);
    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: resourceType,
      folder: `nexium/${organisationId || "default"}`,
    });
    if (!result?.secure_url) {
      throw new Error("No URL returned from Cloudinary");
    }
    return result.secure_url;
  } finally {
    try {
      await fs.unlink(tempPath);
    } catch {
      /* ignore */
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const driver = resolveDriver();
  if (!driver) {
    return NextResponse.json(
      {
        error:
          "Upload not configured – set MinIO (MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET) or Cloudinary env vars.",
      },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (driver === "minio") {
      const stored = await uploadToMinio({
        organisationId: session.organisationId,
        fileName: file.name || "upload",
        contentType: file.type || "application/octet-stream",
        body: buffer,
      });
      return NextResponse.json({ url: stored.url });
    }

    const url = await uploadViaCloudinary(
      buffer,
      file,
      session.organisationId
    );
    return NextResponse.json({ url });
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    const httpCode = typeof err.http_code === "number" ? err.http_code : 500;
    const message =
      typeof err.message === "string" ? err.message : "Upload failed";

    console.error("Upload error:", { driver, message, error: e });

    let userMessage = "Upload failed";
    if (httpCode === 401 && driver === "cloudinary") {
      userMessage =
        "Cloudinary authentication failed – verify Cloudinary credentials in .env";
    } else {
      userMessage = message;
    }

    return NextResponse.json(
      { error: userMessage },
      { status: typeof httpCode === "number" && httpCode >= 400 ? httpCode : 500 }
    );
  }
}
