import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditRoadmap } from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  targetDate: z.string().optional(),
  description: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const milestones = await prisma.milestone.findMany({
    where: { organisationId: session.organisationId, deletedAt: null },
    orderBy: { targetDate: "asc" },
    select: { id: true, name: true, targetDate: true },
  });
  return NextResponse.json(milestones);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditRoadmap(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const targetDate = data.targetDate?.trim()
      ? new Date(data.targetDate)
      : undefined;
    const milestone = await prisma.milestone.create({
      data: {
        organisationId: session.organisationId,
        name: data.name.trim(),
        targetDate: targetDate ?? null,
        description: data.description?.trim() ?? null,
      },
      select: { id: true, name: true, targetDate: true },
    });
    return NextResponse.json(milestone);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }
}
