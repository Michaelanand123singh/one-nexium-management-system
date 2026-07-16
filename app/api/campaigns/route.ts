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
  const ownerId = searchParams.get("ownerId") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (status) where.status = status;
  if (type) where.type = type;
  if (ownerId) where.ownerId = ownerId;

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(campaigns);
}

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["CONTENT", "PARTNERSHIP", "PAID", "EVENT", "COMMUNITY", "REFERRAL"]),
  status: z.enum(["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  ownerId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budget: z.number().optional().nullable(),
  targetMetric: z.string().optional().nullable(),
  actualResult: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
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
    const campaign = await prisma.campaign.create({
      data: {
        organisationId: session.organisationId,
        name: data.name.trim(),
        type: data.type,
        status: (data.status as "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED") ?? "PLANNED",
        ownerId: data.ownerId ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        budget: data.budget ?? null,
        targetMetric: data.targetMetric?.trim() ?? null,
        actualResult: data.actualResult?.trim() ?? null,
        description: data.description?.trim() ?? null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(campaign);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
