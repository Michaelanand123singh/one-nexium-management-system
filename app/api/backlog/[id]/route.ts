import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditBacklog } from "@/lib/permissions";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(["FEATURE", "IMPROVEMENT", "TECH_DEBT", "RESEARCH"]).optional(),
  source: z.enum(["INTERNAL", "CUSTOMER_FEEDBACK", "PARTNER_REQUEST", "COMPETITOR_ANALYSIS"]).optional(),
  priorityScore: z.number().optional().nullable(),
  status: z.enum(["NEW", "REFINED", "GROOMED", "IN_SPRINT", "DONE", "REJECTED"]).optional(),
  epicId: z.string().optional().nullable(),
  effortEstimate: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.backlogItem.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: {
      epic: { select: { id: true, name: true, targetPhase: true } },
      sprint: { select: { id: true, name: true, startDate: true, endDate: true } },
      featureRequest: { select: { id: true, status: true, votes: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBacklog(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.backlogItem.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const item = await prisma.backlogItem.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.priorityScore !== undefined && { priorityScore: data.priorityScore }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.epicId !== undefined && { epicId: data.epicId }),
        ...(data.effortEstimate !== undefined && { effortEstimate: data.effortEstimate }),
        ...(data.sprintId !== undefined && { sprintId: data.sprintId }),
      },
      include: {
        epic: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBacklog(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.backlogItem.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.backlogItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
