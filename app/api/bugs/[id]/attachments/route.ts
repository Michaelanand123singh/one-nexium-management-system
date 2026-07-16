import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditBugs } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: bugId } = await params;
  const bug = await prisma.bug.findFirst({
    where: { id: bugId, organisationId: session.organisationId, deletedAt: null },
  });
  if (!bug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachments = await prisma.bugAttachment.findMany({
    where: { bugId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(attachments);
}

const createSchema = z.object({
  url: z.string().url(),
  type: z.string().min(1),
  documentId: z.string().optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBugs(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: bugId } = await params;
  const bug = await prisma.bug.findFirst({
    where: { id: bugId, organisationId: session.organisationId, deletedAt: null },
  });
  if (!bug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const { url, type, documentId } = createSchema.parse(body);

    if (documentId) {
      const doc = await prisma.document.findFirst({
        where: {
          id: documentId,
          organisationId: session.organisationId,
          deletedAt: null,
          fileUrl: { not: null },
        } as Prisma.DocumentWhereInput,
      });
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
    }

    const attachment = await prisma.bugAttachment.create({
      data: {
        bugId,
        url,
        type: type || "file",
        documentId: documentId ?? null,
      } as Prisma.BugAttachmentUncheckedCreateInput,
    });

    if (!documentId) {
      await prisma.document.create({
        data: {
          organisationId: session.organisationId,
          title: url.split("/").pop() ?? "Attachment",
          fileUrl: url,
          fileName: url.split("/").pop() ?? null,
          sourceType: "bug",
          sourceId: bugId,
        } as Prisma.DocumentUncheckedCreateInput,
      });
    }

    return NextResponse.json(attachment);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to add attachment" }, { status: 500 });
  }
}
