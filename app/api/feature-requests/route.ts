import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  customerId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (status) where.status = status;

  const items = await prisma.featureRequest.findMany({
    where,
    include: {
      backlogItem: { select: { id: true, title: true, status: true } },
      customer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const item = await prisma.featureRequest.create({
      data: {
        organisationId: session.organisationId,
        title: data.title,
        description: data.description ?? null,
        customerId: data.customerId ?? null,
        submittedById: session.id,
      },
      include: {
        customer: { select: { id: true, name: true } },
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
