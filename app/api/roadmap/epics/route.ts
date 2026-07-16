import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditRoadmap } from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  targetPhase: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const epics = await prisma.epic.findMany({
    where: { organisationId: session.organisationId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetPhase: true },
  });
  return NextResponse.json(epics);
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
    const epic = await prisma.epic.create({
      data: {
        organisationId: session.organisationId,
        name: data.name.trim(),
        goal: data.goal?.trim() ?? null,
        targetPhase: data.targetPhase ?? null,
      },
      select: { id: true, name: true, targetPhase: true },
    });
    return NextResponse.json(epic);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create epic" }, { status: 500 });
  }
}
