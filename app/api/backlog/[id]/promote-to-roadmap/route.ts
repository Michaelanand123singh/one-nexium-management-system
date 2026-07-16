import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditBacklog } from "@/lib/permissions";
import { z } from "zod";

const bodySchema = z.object({
  targetPhase: z.string().optional(),
  epicId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBacklog(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const backlogItem = await prisma.backlogItem.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!backlogItem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json().catch(() => ({}));
    const { targetPhase, epicId } = bodySchema.parse(body);
    const roadmapItem = await prisma.roadmapItem.create({
      data: {
        organisationId: session.organisationId,
        title: backlogItem.title,
        description: backlogItem.description,
        status: "PLANNED",
        priority: "MEDIUM",
        targetPhase: targetPhase ?? null,
        epicId: epicId ?? backlogItem.epicId,
      },
      include: {
        epic: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(roadmapItem);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to promote" }, { status: 500 });
  }
}
