import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditCustomerSuccess } from "@/lib/permissions";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: {
      assignedCsm: { select: { id: true, name: true, email: true } },
      supportTickets: {
        where: { deletedAt: null },
        include: { assignedCsm: { select: { id: true, name: true, email: true } } },
        orderBy: { updatedAt: "desc" },
      },
      feedback: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      npsResponses: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { supportTickets: true, feedback: true, npsResponses: true } },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  plan: z.enum(["FREE", "PRO", "BUSINESS"]).optional(),
  churnRisk: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedCsmId: z.string().optional().nullable(),
  onboardingStatus: z.string().optional().nullable(),
  npsScore: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditCustomerSuccess(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.customer.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.email !== undefined) updates.email = data.email.trim().toLowerCase();
    if (data.plan !== undefined) updates.plan = data.plan;
    if (data.churnRisk !== undefined) updates.churnRisk = data.churnRisk;
    if (data.assignedCsmId !== undefined) updates.assignedCsmId = data.assignedCsmId;
    if (data.onboardingStatus !== undefined) updates.onboardingStatus = data.onboardingStatus?.trim() ?? null;
    if (data.npsScore !== undefined) updates.npsScore = data.npsScore;
    if (data.notes !== undefined) updates.notes = data.notes?.trim() ?? null;

    const customer = await prisma.customer.update({
      where: { id },
      data: updates,
      include: {
        assignedCsm: { select: { id: true, name: true, email: true } },
        _count: { select: { supportTickets: true, feedback: true, npsResponses: true } },
      },
    });
    return NextResponse.json(customer);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditCustomerSuccess(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.customer.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
