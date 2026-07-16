import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditBacklog } from "@/lib/permissions";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]).optional(),
  rejectionReason: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.featureRequest.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
    include: {
      backlogItem: { select: { id: true, title: true, status: true } },
      customer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBacklog(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.featureRequest.findFirst({
    where: { id, organisationId: session.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    if (data.status === "ACCEPTED") {
      const backlogItem = await prisma.backlogItem.create({
        data: {
          organisationId: session.organisationId,
          title: existing.title,
          description: existing.description,
          source: "CUSTOMER_FEEDBACK",
          status: "NEW",
        },
      });
      await prisma.featureRequest.update({
        where: { id },
        data: { status: "ACCEPTED", backlogItemId: backlogItem.id },
      });
      const updated = await prisma.featureRequest.findUnique({
        where: { id },
        include: { backlogItem: true, customer: true },
      });
      return NextResponse.json(updated);
    }

    const item = await prisma.featureRequest.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason }),
      },
      include: { backlogItem: true, customer: true },
    });
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
