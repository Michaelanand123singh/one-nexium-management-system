import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditBugs } from "@/lib/permissions";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bug = await prisma.bug.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true, status: true, sprintId: true } },
      customer: { select: { id: true, name: true, email: true } },
      attachments: true,
    },
  });
  if (!bug) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bug);
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  stepsToReproduce: z.string().optional().nullable(),
  expectedBehaviour: z.string().optional().nullable(),
  actualBehaviour: z.string().optional().nullable(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  platform: z.string().optional().nullable(),
  browserDevice: z.string().optional().nullable(),
  status: z
    .enum(["NEW", "CONFIRMED", "IN_PROGRESS", "FIXED", "VERIFIED", "CLOSED", "WONT_FIX"])
    .optional(),
  assignedToId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBugs(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.bug.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.description !== undefined) updates.description = data.description;
    if (data.stepsToReproduce !== undefined) updates.stepsToReproduce = data.stepsToReproduce;
    if (data.expectedBehaviour !== undefined) updates.expectedBehaviour = data.expectedBehaviour;
    if (data.actualBehaviour !== undefined) updates.actualBehaviour = data.actualBehaviour;
    if (data.severity !== undefined) updates.severity = data.severity;
    if (data.platform !== undefined) updates.platform = data.platform;
    if (data.browserDevice !== undefined) updates.browserDevice = data.browserDevice;
    if (data.status !== undefined) updates.status = data.status;
    if (data.assignedToId !== undefined) updates.assignedToId = data.assignedToId;
    if (data.taskId !== undefined) updates.taskId = data.taskId;
    if (data.sprintId !== undefined) updates.sprintId = data.sprintId;
    if (data.resolutionNotes !== undefined) updates.resolutionNotes = data.resolutionNotes;
    if (data.status === "CLOSED" || data.status === "WONT_FIX") {
      updates.closedAt = new Date();
    }

    const bug = await prisma.bug.update({
      where: { id },
      data: updates,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, title: true, status: true, sprintId: true } },
      },
    });
    return NextResponse.json(bug);
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
  if (!canEditBugs(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.bug.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.bug.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
