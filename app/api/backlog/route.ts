import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditBacklog } from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["FEATURE", "IMPROVEMENT", "TECH_DEBT", "RESEARCH"]).optional(),
  source: z.enum(["INTERNAL", "CUSTOMER_FEEDBACK", "PARTNER_REQUEST", "COMPETITOR_ANALYSIS"]).optional(),
  priorityScore: z.number().optional(),
  status: z.enum(["NEW", "REFINED", "GROOMED", "IN_SPRINT", "DONE", "REJECTED"]).optional(),
  epicId: z.string().optional(),
  effortEstimate: z.string().optional(),
  sprintId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const source = searchParams.get("source") ?? undefined;
  const epicId = searchParams.get("epicId") ?? undefined;
  const phase = searchParams.get("phase") ?? undefined;
  const sort = searchParams.get("sort") ?? "priorityScore"; // priorityScore | createdAt

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (status) where.status = status;
  if (type) where.type = type;
  if (source) where.source = source;
  if (epicId) where.epicId = epicId;
  if (phase) {
    (where as Record<string, unknown>).epic = { targetPhase: phase };
  }

  const orderBy: Record<string, string>[] =
    sort === "createdAt"
      ? [{ createdAt: "desc" }]
      : [{ priorityScore: "desc" }, { createdAt: "desc" }];

  const items = await prisma.backlogItem.findMany({
    where,
    include: {
      epic: { select: { id: true, name: true } },
      sprint: { select: { id: true, name: true } },
      featureRequest: { select: { id: true, status: true } },
    },
    orderBy,
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBacklog(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const item = await prisma.backlogItem.create({
      data: {
        organisationId: session.organisationId,
        title: data.title,
        description: data.description ?? null,
        type: (data.type as "FEATURE" | "IMPROVEMENT" | "TECH_DEBT" | "RESEARCH") ?? "FEATURE",
        source: (data.source as "INTERNAL" | "CUSTOMER_FEEDBACK" | "PARTNER_REQUEST" | "COMPETITOR_ANALYSIS") ?? "INTERNAL",
        priorityScore: data.priorityScore ?? null,
        status: (data.status as "NEW" | "REFINED" | "GROOMED" | "IN_SPRINT" | "DONE" | "REJECTED") ?? "NEW",
        epicId: data.epicId ?? null,
        effortEstimate: data.effortEstimate ?? null,
        sprintId: data.sprintId ?? null,
      },
      include: {
        epic: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
