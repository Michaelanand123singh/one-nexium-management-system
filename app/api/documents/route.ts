import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DocumentType } from "@prisma/client";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "all"; // all | file | wiki
  const type = searchParams.get("type") ?? undefined;
  const folderId = searchParams.get("folderId") ?? undefined;
  const sourceType = searchParams.get("sourceType") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
    isFolder: false,
  };
  if (kind === "file") where.fileUrl = { not: null };
  if (kind === "wiki") where.fileUrl = null;
  if (type) where.type = type as DocumentType;
  if (folderId !== undefined) where.folderId = folderId || null;
  if (sourceType) where.sourceType = sourceType;

  const documents = await prisma.document.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
  });

  return NextResponse.json(documents);
}

const createSchema = z
  .object({
    title: z.string().min(1),
    content: z.string().optional().nullable(),
    type: z.nativeEnum(DocumentType).optional().nullable(),
    folderId: z.string().optional().nullable(),
    isFolder: z.boolean().optional(),
    fileUrl: z.string().optional().nullable(),
    fileName: z.string().optional().nullable(),
    mimeType: z.string().optional().nullable(),
    fileSize: z.number().int().optional().nullable(),
    sourceType: z.string().optional().nullable(),
    sourceId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "library" && data.fileName && !data.fileUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileUrl is required for file uploads",
        path: ["fileUrl"],
      });
    }
  });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const doc = await prisma.document.create({
      data: {
        organisationId: session.organisationId,
        title: data.title.trim(),
        content: data.content ?? null,
        type: data.type ?? null,
        folderId: data.folderId ?? null,
        isFolder: data.isFolder ?? false,
        fileUrl: data.fileUrl ?? null,
        fileName: data.fileName ?? null,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? null,
        sourceType: data.sourceType ?? "library",
        sourceId: data.sourceId ?? null,
      },
    });
    return NextResponse.json(doc);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
