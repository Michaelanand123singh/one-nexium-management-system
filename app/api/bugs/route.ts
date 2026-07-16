import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditBugs } from "@/lib/permissions";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const assignedToId = searchParams.get("assignedToId") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (assignedToId) where.assignedToId = assignedToId;

  const bugs = await prisma.bug.findMany({
    where,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true, status: true, sprintId: true } },
    },
    orderBy: [{ status: "asc" }, { severity: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(bugs);
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  stepsToReproduce: z.string().optional(),
  expectedBehaviour: z.string().optional(),
  actualBehaviour: z.string().optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  platform: z.string().optional(),
  browserDevice: z.string().optional(),
  assignedToId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBugs(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const bug = await prisma.bug.create({
      data: {
        organisationId: session.organisationId,
        title: data.title.trim(),
        description: data.description?.trim() ?? null,
        stepsToReproduce: data.stepsToReproduce?.trim() ?? null,
        expectedBehaviour: data.expectedBehaviour?.trim() ?? null,
        actualBehaviour: data.actualBehaviour?.trim() ?? null,
        severity: (data.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") ?? "MEDIUM",
        platform: data.platform?.trim() ?? null,
        browserDevice: data.browserDevice?.trim() ?? null,
        assignedToId: data.assignedToId ?? null,
        taskId: data.taskId ?? null,
        sprintId: data.sprintId ?? null,
        reportedById: session.id,
      },
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
    return NextResponse.json({ error: "Failed to create bug" }, { status: 500 });
  }
}
