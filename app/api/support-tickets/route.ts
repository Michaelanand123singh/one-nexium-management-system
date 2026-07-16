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
  const customerId = searchParams.get("customerId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;

  const tickets = await prisma.supportTicket.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, email: true } },
      assignedCsm: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(tickets);
}

const createSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  severity: z.string().optional().nullable(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  assignedCsmId: z.string().optional().nullable(),
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
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organisationId: session.organisationId, deletedAt: null },
    });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const ticket = await prisma.supportTicket.create({
      data: {
        organisationId: session.organisationId,
        customerId: data.customerId,
        title: data.title.trim(),
        description: data.description?.trim() ?? null,
        severity: data.severity?.trim() ?? null,
        status: (data.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED") ?? "OPEN",
        assignedCsmId: data.assignedCsmId ?? null,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedCsm: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(ticket);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
