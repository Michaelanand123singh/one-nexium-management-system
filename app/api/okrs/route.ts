import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditOkrs } from "@/lib/permissions";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? undefined;
  const level = searchParams.get("level") ?? undefined;
  const ownerId = searchParams.get("ownerId") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (period) where.period = period;
  if (level) where.level = level;
  if (ownerId) where.ownerId = ownerId;

  const okrs = await prisma.okr.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      parentOkr: { select: { id: true, objective: true, period: true } },
      _count: { select: { keyResults: true } },
    },
    orderBy: [{ period: "desc" }, { level: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(okrs);
}

const keyResultCreateSchema = z.object({
  metricName: z.string().min(1),
  targetValue: z.number(),
  unit: z.string().optional().nullable(),
});

const createSchema = z.object({
  objective: z.string().min(1),
  period: z.string().min(1),
  level: z.enum(["COMPANY", "TEAM", "INDIVIDUAL"]),
  ownerId: z.string().optional(),
  parentOkrId: z.string().optional().nullable(),
  keyResults: z.array(keyResultCreateSchema).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditOkrs(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const ownerId = data.ownerId ?? session.id;

    const okr = await prisma.okr.create({
      data: {
        organisationId: session.organisationId,
        ownerId,
        objective: data.objective.trim(),
        period: data.period.trim(),
        level: data.level,
        parentOkrId: data.parentOkrId ?? null,
        keyResults: data.keyResults?.length
          ? {
              create: data.keyResults.map((kr) => ({
                metricName: kr.metricName.trim(),
                targetValue: kr.targetValue,
                unit: kr.unit?.trim() ?? null,
                currentValue: 0,
                progress: 0,
              })),
            }
          : undefined,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        parentOkr: { select: { id: true, objective: true, period: true } },
        keyResults: true,
        _count: { select: { keyResults: true } },
      },
    });
    return NextResponse.json(okr);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create OKR" }, { status: 500 });
  }
}
