import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUsePlanning } from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  url: z.string().min(1).max(4000),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: cardId } = await params;

  const card = await prisma.planningCard.findFirst({
    where: {
      id: cardId,
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const count = await prisma.planningCardAttachment.count({
      where: { planningCardId: cardId },
    });
    if (count >= 30) {
      return NextResponse.json({ error: "Maximum 30 attachments per card" }, { status: 400 });
    }

    const row = await prisma.planningCardAttachment.create({
      data: {
        planningCardId: cardId,
        organisationId: session.organisationId,
        url: data.url,
        fileName: data.fileName,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? null,
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to add attachment" }, { status: 500 });
  }
}
