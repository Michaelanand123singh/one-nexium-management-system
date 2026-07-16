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
  const partner = await prisma.partner.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(partner);
}

const updateSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactPerson: z.string().optional().nullable(),
  type: z.enum(["RESELLER", "REFERRAL", "AGENCY", "INFLUENCER", "INTEGRATION", "COMMUNITY"]).optional(),
  tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).optional(),
  region: z.string().optional().nullable(),
  niche: z.string().optional().nullable(),
  audienceSize: z.string().optional().nullable(),
  status: z.enum(["APPLIED", "ACTIVE", "PAUSED", "CHURNED"]).optional(),
  pipelineStage: z.enum(["IDENTIFIED", "CONTACTED", "IN_DISCUSSION", "AGREEMENT_SIGNED", "ACTIVE"]).optional(),
  assignedToId: z.string().optional().nullable(),
  referralCode: z.string().optional().nullable(),
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
  const existing = await prisma.partner.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const updates: Record<string, unknown> = {};
    if (data.companyName !== undefined) updates.companyName = data.companyName.trim();
    if (data.contactPerson !== undefined) updates.contactPerson = data.contactPerson?.trim() ?? null;
    if (data.type !== undefined) updates.type = data.type;
    if (data.tier !== undefined) updates.tier = data.tier;
    if (data.region !== undefined) updates.region = data.region?.trim() ?? null;
    if (data.niche !== undefined) updates.niche = data.niche?.trim() ?? null;
    if (data.audienceSize !== undefined) updates.audienceSize = data.audienceSize?.trim() ?? null;
    if (data.status !== undefined) updates.status = data.status;
    if (data.pipelineStage !== undefined) updates.pipelineStage = data.pipelineStage;
    if (data.assignedToId !== undefined) updates.assignedToId = data.assignedToId;
    if (data.referralCode !== undefined) updates.referralCode = data.referralCode?.trim() ?? null;

    const partner = await prisma.partner.update({
      where: { id },
      data: updates,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(partner);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update partner" }, { status: 500 });
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
  const existing = await prisma.partner.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.partner.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
