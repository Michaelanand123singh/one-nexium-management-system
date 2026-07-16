import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUsePlanning } from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  sortOrder: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const agg = await prisma.planningBucket.aggregate({
        where: {
          organisationId: session.organisationId,
          userId: session.id,
          deletedAt: null,
        },
        _max: { sortOrder: true },
      });
      sortOrder = (agg._max.sortOrder ?? -1) + 1;
    }

    const now = new Date();
    const bucket = await prisma.planningBucket.create({
      data: {
        organisationId: session.organisationId,
        userId: session.id,
        name: data.name.trim(),
        sortOrder,
        updatedAt: now,
      },
    });
    return NextResponse.json(bucket);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create bucket" }, { status: 500 });
  }
}
