/**
 * Object storage for file uploads.
 * Prefers MinIO (S3-compatible) when configured; Cloudinary remains an optional fallback.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";

export type StoredObject = {
  /** Public app URL used by UI (same-origin /api/files/... for MinIO). */
  url: string;
  key: string;
  bucket: string;
};

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

export function isMinioConfigured(): boolean {
  return !!(
    process.env.MINIO_ENDPOINT?.trim() &&
    process.env.MINIO_ACCESS_KEY?.trim() &&
    process.env.MINIO_SECRET_KEY?.trim() &&
    process.env.MINIO_BUCKET?.trim()
  );
}

let s3Client: S3Client | null = null;
let bucketEnsured = false;

export function getS3Client(): S3Client {
  if (!isMinioConfigured()) {
    throw new Error("MinIO is not configured");
  }
  if (!s3Client) {
    const endpoint = trimSlash(process.env.MINIO_ENDPOINT!.trim());
    s3Client = new S3Client({
      region: process.env.MINIO_REGION?.trim() || "us-east-1",
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!.trim(),
        secretAccessKey: process.env.MINIO_SECRET_KEY!.trim(),
      },
    });
  }
  return s3Client;
}

export function getMinioBucket(): string {
  return process.env.MINIO_BUCKET!.trim();
}

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const client = getS3Client();
  const bucket = getMinioBucket();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (e: unknown) {
      // Race: another instance created it
      const msg = e instanceof Error ? e.message : String(e);
      if (!/BucketAlreadyOwnedByYou|BucketAlreadyExists|owned by you/i.test(msg)) {
        throw e;
      }
    }
  }
  bucketEnsured = true;
}

function safeExt(fileName: string): string {
  const ext = path.extname(fileName || "").replace(/[^a-zA-Z0-9.]/g, "");
  return ext || ".bin";
}

function safeFileName(fileName: string): string {
  const base = path.basename(fileName || "upload");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload";
}

/** Build object key scoped to organisation (required for /api/files auth). */
export function buildObjectKey(organisationId: string, fileName: string): string {
  const ext = safeExt(fileName);
  const name = safeFileName(fileName).replace(ext, "") || "file";
  return `${organisationId}/${randomUUID()}-${name}${ext}`;
}

/**
 * Public URL stored in DB. Prefer app URL so browsers hit same-origin /api/files.
 */
export function buildFileAccessUrl(objectKey: string): string {
  const appUrl = trimSlash(
    process.env.NEXIUM_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      ""
  );
  const pathPart = `/api/files/${objectKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  if (appUrl) return `${appUrl}${pathPart}`;
  return pathPart;
}

export async function uploadToMinio(params: {
  organisationId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}): Promise<StoredObject> {
  await ensureBucket();
  const bucket = getMinioBucket();
  const key = buildObjectKey(params.organisationId, params.fileName);
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.body,
      ContentType: params.contentType || "application/octet-stream",
    })
  );

  return {
    url: buildFileAccessUrl(key),
    key,
    bucket,
  };
}

export async function getMinioObject(key: string): Promise<{
  webStream: ReadableStream;
  contentType?: string;
  contentLength?: number;
}> {
  const client = getS3Client();
  const bucket = getMinioBucket();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  if (!res.Body) {
    throw new Error("Empty object body");
  }
  const body = res.Body as {
    transformToWebStream?: () => ReadableStream;
  };
  if (typeof body.transformToWebStream !== "function") {
    throw new Error("Unsupported MinIO response body");
  }
  return {
    webStream: body.transformToWebStream(),
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  };
}

/** Whether object key belongs to this organisation (prevents cross-tenant reads). */
export function objectKeyBelongsToOrg(key: string, organisationId: string): boolean {
  return key === organisationId || key.startsWith(`${organisationId}/`);
}
