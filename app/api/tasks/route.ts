import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditSprint } from "@/lib/permissions";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sprintId = searchParams.get("sprintId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const assigneeId = searchParams.get("assigneeId") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (sprintId) where.sprintId = sprintId;
  if (status) where.status = status;
  if (assigneeId) where.assigneeId = assigneeId;

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      sprint: { select: { id: true, name: true } },
      epic: { select: { id: true, name: true } },
      roadmapItem: { select: { id: true, title: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(tasks);
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["FEATURE", "BUG", "TECH_DEBT", "RESEARCH"]).optional(),
  status: z.enum(["BACKLOG", "TO_DO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  storyPoints: z.number().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  epicId: z.string().optional().nullable(),
  roadmapItemId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSprint(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const task = await prisma.task.create({
      data: {
        organisationId: session.organisationId,
        title: data.title.trim(),
        description: data.description?.trim() ?? null,
        type: (data.type as "FEATURE" | "BUG" | "TECH_DEBT" | "RESEARCH") ?? "FEATURE",
        status: (data.status as "BACKLOG" | "TO_DO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE") ?? "BACKLOG",
        priority: (data.priority as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") ?? "MEDIUM",
        storyPoints: data.storyPoints ?? null,
        sprintId: data.sprintId ?? null,
        epicId: data.epicId ?? null,
        roadmapItemId: data.roadmapItemId ?? null,
        assigneeId: data.assigneeId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        reporterId: session.id,
      },
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
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
