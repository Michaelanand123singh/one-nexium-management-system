import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getMinioObject,
  isMinioConfigured,
  objectKeyBelongsToOrg,
} from "@/lib/storage";

export const runtime = "nodejs";

type Params = { params: Promise<{ key: string[] }> };

/**
 * Authenticated download of objects stored in MinIO.
 * Keys are scoped as `{organisationId}/...` so tenants cannot read each other's files.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMinioConfigured()) {
    return NextResponse.json({ error: "File storage not configured" }, { status: 503 });
  }

  const segments = (await params).key ?? [];
  if (segments.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = segments.map((s) => decodeURIComponent(s)).join("/");
  if (!objectKeyBelongsToOrg(key, session.organisationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const obj = await getMinioObject(key);
    const fileName = key.split("/").pop() || "file";

    return new NextResponse(obj.webStream, {
      status: 200,
      headers: {
        "Content-Type": obj.contentType || "application/octet-stream",
        ...(obj.contentLength != null
          ? { "Content-Length": String(obj.contentLength) }
          : {}),
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("File download error:", e);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
