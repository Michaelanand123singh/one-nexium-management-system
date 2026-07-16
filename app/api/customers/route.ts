import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditCustomerSuccess } from "@/lib/permissions";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditCustomerSuccess(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan") ?? undefined;
  const churnRisk = searchParams.get("churnRisk") ?? undefined;
  const assignedCsmId = searchParams.get("assignedCsmId") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (plan) where.plan = plan;
  if (churnRisk) where.churnRisk = churnRisk;
  if (assignedCsmId) where.assignedCsmId = assignedCsmId;

  const customers = await prisma.customer.findMany({
    where,
    include: {
      assignedCsm: { select: { id: true, name: true, email: true } },
      _count: {
        select: { supportTickets: true, feedback: true, npsResponses: true },
      },
    },
    orderBy: [{ churnRisk: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(customers);
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  plan: z.enum(["FREE", "PRO", "BUSINESS"]).optional(),
  churnRisk: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedCsmId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditCustomerSuccess(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const customer = await prisma.customer.create({
      data: {
        organisationId: session.organisationId,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        plan: (data.plan as "FREE" | "PRO" | "BUSINESS") ?? "FREE",
        churnRisk: (data.churnRisk as "LOW" | "MEDIUM" | "HIGH") ?? "LOW",
        assignedCsmId: data.assignedCsmId ?? null,
        notes: data.notes?.trim() ?? null,
      },
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
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
