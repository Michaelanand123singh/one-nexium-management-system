import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUsePlanning } from "@/lib/permissions";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  sortOrder: z.number().int().optional(),
});

const deleteSchema = z.object({
  targetBucketId: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.planningBucket.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);
    const bucket = await prisma.planningBucket.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
    return NextResponse.json(bucket);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update bucket" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.planningBucket.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let targetBucketId: string;
  try {
    const body = await request.json();
    targetBucketId = deleteSchema.parse(body).targetBucketId;
  } catch {
    return NextResponse.json(
      { error: "targetBucketId required in JSON body" },
      { status: 400 }
    );
  }

  if (targetBucketId === id) {
    return NextResponse.json({ error: "targetBucketId must differ from deleted bucket" }, { status: 400 });
  }

  const target = await prisma.planningBucket.findFirst({
    where: {
      id: targetBucketId,
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });
  if (!target) return NextResponse.json({ error: "Target bucket not found" }, { status: 404 });

  const maxOrder = await prisma.planningCard.aggregate({
    where: { bucketId: targetBucketId, deletedAt: null },
    _max: { sortOrder: true },
  });
  let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const cards = await prisma.planningCard.findMany({
    where: { bucketId: id, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });

  await prisma.$transaction([
    ...cards.map((c) =>
      prisma.planningCard.update({
        where: { id: c.id },
        data: { bucketId: targetBucketId, sortOrder: nextOrder++ },
      })
    ),
    prisma.planningBucket.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
