import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/documents/library - list only file documents for "attach from library" picker */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
    isFolder: false,
    fileUrl: { not: null },
  };
  if (q.trim()) {
    where.OR = [
      { title: { contains: q.trim(), mode: "insensitive" } },
      { fileName: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  const select = {
    id: true,
    title: true,
    fileName: true,
    fileUrl: true,
    mimeType: true,
    sourceType: true,
    updatedAt: true,
  } as const;

  const documents = await prisma.document.findMany({
    where,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: select as any,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(documents);
}
