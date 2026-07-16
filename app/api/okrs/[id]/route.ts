import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditOkrs } from "@/lib/permissions";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const okr = await prisma.okr.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      parentOkr: { select: { id: true, objective: true, period: true, level: true } },
      keyResults: true,
      childOkrs: { select: { id: true, objective: true, period: true, level: true } },
    },
  });
  if (!okr) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(okr);
}

const keyResultSchema = z.object({
  id: z.string().optional(),
  metricName: z.string().min(1),
  currentValue: z.number().optional(),
  targetValue: z.number(),
  unit: z.string().optional().nullable(),
  confidence: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK"]).optional(),
});

const updateSchema = z.object({
  objective: z.string().min(1).optional(),
  period: z.string().min(1).optional(),
  level: z.enum(["COMPANY", "TEAM", "INDIVIDUAL"]).optional(),
  ownerId: z.string().optional(),
  parentOkrId: z.string().optional().nullable(),
  keyResults: z.array(keyResultSchema).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditOkrs(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.okr.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: { keyResults: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const updates: Record<string, unknown> = {};
    if (data.objective !== undefined) updates.objective = data.objective.trim();
    if (data.period !== undefined) updates.period = data.period.trim();
    if (data.level !== undefined) updates.level = data.level;
    if (data.ownerId !== undefined) updates.ownerId = data.ownerId;
    if (data.parentOkrId !== undefined) updates.parentOkrId = data.parentOkrId;

    if (data.keyResults !== undefined) {
      const submittedIds = new Set(
        data.keyResults.map((kr) => kr.id).filter((x): x is string => !!x)
      );
      const toDelete = existing.keyResults.filter((kr) => !submittedIds.has(kr.id));
      await prisma.$transaction([
        ...toDelete.map((kr) => prisma.keyResult.delete({ where: { id: kr.id } })),
        ...data.keyResults.map((kr) => {
          const currentVal = kr.currentValue ?? 0;
          const progress =
            kr.targetValue !== 0 ? Math.min(100, (currentVal / kr.targetValue) * 100) : 0;
          const payload = {
            metricName: kr.metricName.trim(),
            targetValue: kr.targetValue,
            unit: kr.unit?.trim() ?? null,
            currentValue: currentVal,
            progress,
            confidence: (kr.confidence as "ON_TRACK" | "AT_RISK" | "OFF_TRACK") ?? "ON_TRACK",
          };
          if (kr.id && existing.keyResults.some((e) => e.id === kr.id)) {
            return prisma.keyResult.update({
              where: { id: kr.id },
              data: payload,
            });
          }
          return prisma.keyResult.create({
            data: { okrId: id, ...payload },
          });
        }),
      ]);
    }

    const okr = await prisma.okr.update({
      where: { id },
      data: updates,
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
    return NextResponse.json({ error: "Failed to update OKR" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditOkrs(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.okr.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.okr.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
