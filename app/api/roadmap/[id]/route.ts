import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canEditRoadmapItem,
  canSetPublicRoadmap,
} from "@/lib/permissions";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "SHIPPED", "CANCELLED"]).optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  assignedTeam: z.string().optional().nullable(),
  targetPhase: z.string().optional().nullable(),
  epicId: z.string().optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.roadmapItem.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      deletedAt: null,
    },
    include: {
      epic: { select: { id: true, name: true, targetPhase: true } },
      milestone: { select: { id: true, name: true, targetDate: true } },
      roadmapHistory: {
        orderBy: { changedAt: "desc" },
        take: 50,
        include: { changedBy: { select: { id: true, name: true, email: true } } },
      },
      tasks: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true, assigneeId: true },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

async function recordHistory(
  roadmapItemId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  userId: string
) {
  await prisma.roadmapItemHistory.create({
    data: {
      roadmapItemId,
      field,
      oldValue,
      newValue,
      changedById: userId,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.roadmapItem.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      deletedAt: null,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit = canEditRoadmapItem(session.role, existing.assignedTeam);
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Eng Lead edits Engineering items only — cannot reassign team away from Engineering.
    if (
      session.role === "ENGINEERING_LEAD" &&
      data.assignedTeam !== undefined &&
      data.assignedTeam !== existing.assignedTeam
    ) {
      return NextResponse.json(
        { error: "Engineering Lead cannot change assigned team" },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.status !== undefined) updates.status = data.status;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.assignedTeam !== undefined) updates.assignedTeam = data.assignedTeam;
    if (data.targetPhase !== undefined) updates.targetPhase = data.targetPhase;
    if (data.epicId !== undefined) updates.epicId = data.epicId;
    if (data.milestoneId !== undefined) updates.milestoneId = data.milestoneId;
    if (data.isPublic !== undefined) {
      if (!canSetPublicRoadmap(session.role)) {
        return NextResponse.json({ error: "Only Super Admin can set public" }, { status: 403 });
      }
      updates.isPublic = data.isPublic;
    }

    for (const [field, newVal] of Object.entries(updates)) {
      const oldVal = existing[field as keyof typeof existing];
      const oldStr = oldVal == null ? null : String(oldVal);
      const newStr = newVal == null ? null : String(newVal);
      if (oldStr !== newStr) {
        await recordHistory(id, field, oldStr, newStr, session.id);
      }
    }

    const item = await prisma.roadmapItem.update({
      where: { id },
      data: updates,
      include: {
        epic: { select: { id: true, name: true } },
        milestone: { select: { id: true, name: true } },
      },
    });
    await prisma.activityLog.create({
      data: {
        organisationId: session.organisationId,
        userId: session.id,
        action: "updated",
        entityType: "roadmap_item",
        entityId: id,
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

  const { canEditRoadmap } = await import("@/lib/permissions");
  if (!canEditRoadmap(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.roadmapItem.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      deletedAt: null,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.roadmapItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await prisma.activityLog.create({
    data: {
      organisationId: session.organisationId,
      userId: session.id,
      action: "deleted",
      entityType: "roadmap_item",
      entityId: id,
    },
  });
  return NextResponse.json({ ok: true });
}
