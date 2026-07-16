import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditGtm } from "@/lib/permissions";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const assignedToId = searchParams.get("assignedToId") ?? undefined;
  const pipelineStage = searchParams.get("pipelineStage") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (status) where.status = status;
  if (type) where.type = type;
  if (assignedToId) where.assignedToId = assignedToId;
  if (pipelineStage) where.pipelineStage = pipelineStage;

  const partners = await prisma.partner.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ pipelineStage: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(partners);
}

const createSchema = z.object({
  companyName: z.string().min(1),
  contactPerson: z.string().optional().nullable(),
  type: z.enum(["RESELLER", "REFERRAL", "AGENCY", "INFLUENCER", "INTEGRATION", "COMMUNITY"]),
  tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).optional(),
  region: z.string().optional().nullable(),
  niche: z.string().optional().nullable(),
  audienceSize: z.string().optional().nullable(),
  status: z.enum(["APPLIED", "ACTIVE", "PAUSED", "CHURNED"]).optional(),
  pipelineStage: z.enum(["IDENTIFIED", "CONTACTED", "IN_DISCUSSION", "AGREEMENT_SIGNED", "ACTIVE"]).optional(),
  assignedToId: z.string().optional().nullable(),
  referralCode: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditGtm(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const partner = await prisma.partner.create({
      data: {
        organisationId: session.organisationId,
        companyName: data.companyName.trim(),
        contactPerson: data.contactPerson?.trim() ?? null,
        type: data.type,
        tier: (data.tier as "BRONZE" | "SILVER" | "GOLD" | "PLATINUM") ?? "BRONZE",
        region: data.region?.trim() ?? null,
        niche: data.niche?.trim() ?? null,
        audienceSize: data.audienceSize?.trim() ?? null,
        status: (data.status as "APPLIED" | "ACTIVE" | "PAUSED" | "CHURNED") ?? "APPLIED",
        pipelineStage: (data.pipelineStage as "IDENTIFIED" | "CONTACTED" | "IN_DISCUSSION" | "AGREEMENT_SIGNED" | "ACTIVE") ?? "IDENTIFIED",
        assignedToId: data.assignedToId ?? null,
        referralCode: data.referralCode?.trim() ?? null,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(partner);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create partner" }, { status: 500 });
  }
}
