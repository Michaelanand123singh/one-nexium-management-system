import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditSprint } from "@/lib/permissions";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
      sprint: { select: { id: true, name: true, status: true } },
      epic: { select: { id: true, name: true } },
      roadmapItem: { select: { id: true, title: true } },
      subtasks: { orderBy: { order: "asc" } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(["FEATURE", "BUG", "TECH_DEBT", "RESEARCH"]).optional(),
  status: z.enum(["BACKLOG", "TO_DO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  storyPoints: z.number().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  epicId: z.string().optional().nullable(),
  roadmapItemId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  isBlocked: z.boolean().optional(),
  blockedReason: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSprint(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.task.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.description !== undefined) updates.description = data.description;
    if (data.type !== undefined) updates.type = data.type;
    if (data.status !== undefined) updates.status = data.status;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.storyPoints !== undefined) updates.storyPoints = data.storyPoints;
    if (data.sprintId !== undefined) updates.sprintId = data.sprintId;
    if (data.epicId !== undefined) updates.epicId = data.epicId;
    if (data.roadmapItemId !== undefined) updates.roadmapItemId = data.roadmapItemId;
    if (data.assigneeId !== undefined) updates.assigneeId = data.assigneeId;
    if (data.dueDate !== undefined) updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.isBlocked !== undefined) updates.isBlocked = data.isBlocked;
    if (data.blockedReason !== undefined) updates.blockedReason = data.blockedReason;

    const task = await prisma.task.update({
      where: { id },
      data: updates,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        sprint: { select: { id: true, name: true } },
        epic: { select: { id: true, name: true } },
        roadmapItem: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json(task);
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
  if (!canEditSprint(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.task.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.task.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
