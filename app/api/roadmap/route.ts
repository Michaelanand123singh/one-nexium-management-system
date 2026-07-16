import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "SHIPPED", "CANCELLED"]).optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  assignedTeam: z.string().optional(),
  targetPhase: z.string().optional(),
  epicId: z.string().optional(),
  milestoneId: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const phase = searchParams.get("phase") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const team = searchParams.get("team") ?? undefined;
  const epicId = searchParams.get("epicId") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (phase) where.targetPhase = phase;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (team) where.assignedTeam = team;
  if (epicId) where.epicId = epicId;

  const items = await prisma.roadmapItem.findMany({
    where,
    include: {
      epic: { select: { id: true, name: true } },
      milestone: { select: { id: true, name: true, targetDate: true } },
    },
    orderBy: [{ targetPhase: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { canEditRoadmap } = await import("@/lib/permissions");
  if (!canEditRoadmap(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const item = await prisma.roadmapItem.create({
      data: {
        organisationId: session.organisationId,
        title: data.title,
        description: data.description ?? null,
        status: (data.status as "PLANNED" | "IN_PROGRESS" | "SHIPPED" | "CANCELLED") ?? "PLANNED",
        priority: (data.priority as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") ?? "MEDIUM",
        assignedTeam: data.assignedTeam ?? null,
        targetPhase: data.targetPhase ?? null,
        epicId: data.epicId ?? null,
        milestoneId: data.milestoneId ?? null,
        isPublic: data.isPublic ?? false,
      },
      include: {
        epic: { select: { id: true, name: true } },
        milestone: { select: { id: true, name: true } },
      },
    });
    await prisma.activityLog.create({
      data: {
        organisationId: session.organisationId,
        userId: session.id,
        action: "created",
        entityType: "roadmap_item",
        entityId: item.id,
      },
    });
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
