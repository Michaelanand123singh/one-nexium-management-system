import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditSprint } from "@/lib/permissions";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (status) where.status = status;

  const sprints = await prisma.sprint.findMany({
    where,
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, goal: true, status: true, startDate: true, endDate: true },
  });
  return NextResponse.json(sprints);
}

const createSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED"]).optional(),
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
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const sprint = await prisma.sprint.create({
      data: {
        organisationId: session.organisationId,
        name: data.name.trim(),
        goal: data.goal?.trim() ?? null,
        startDate,
        endDate,
        status: data.status ?? "PLANNED",
      },
      select: { id: true, name: true, goal: true, status: true, startDate: true, endDate: true },
    });
    return NextResponse.json(sprint);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create sprint" }, { status: 500 });
  }
}
