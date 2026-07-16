import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditGtm } from "@/lib/permissions";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["CONTENT", "PARTNERSHIP", "PAID", "EVENT", "COMMUNITY", "REFERRAL"]).optional(),
  status: z.enum(["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  ownerId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budget: z.number().optional().nullable(),
  targetMetric: z.string().optional().nullable(),
  actualResult: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditGtm(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.campaign.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.type !== undefined) updates.type = data.type;
    if (data.status !== undefined) updates.status = data.status;
    if (data.ownerId !== undefined) updates.ownerId = data.ownerId;
    if (data.startDate !== undefined) updates.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updates.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.budget !== undefined) updates.budget = data.budget;
    if (data.targetMetric !== undefined) updates.targetMetric = data.targetMetric?.trim() ?? null;
    if (data.actualResult !== undefined) updates.actualResult = data.actualResult?.trim() ?? null;
    if (data.description !== undefined) updates.description = data.description?.trim() ?? null;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updates,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(campaign);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditGtm(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.campaign.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
