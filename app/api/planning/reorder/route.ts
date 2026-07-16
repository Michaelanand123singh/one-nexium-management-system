import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUsePlanning } from "@/lib/permissions";
import { isDoneBucketName } from "@/lib/planning";
import { z } from "zod";

const bodySchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      bucketId: z.string().min(1).optional(),
      sortOrder: z.number().int(),
    })
  ),
});

/**
 * Batch update card order (and optionally bucket) after drag-and-drop.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const { items } = bodySchema.parse(json);
    if (items.length === 0) return NextResponse.json({ ok: true });

    const ids = [...new Set(items.map((i) => i.id))];
    const cards = await prisma.planningCard.findMany({
      where: {
        id: { in: ids },
        organisationId: session.organisationId,
        userId: session.id,
        deletedAt: null,
      },
      include: { bucket: true },
    });
    if (cards.length !== ids.length) {
      return NextResponse.json({ error: "One or more cards not found" }, { status: 404 });
    }

    const bucketIdsNeeded = new Set<string>();
    for (const item of items) {
      const c = cards.find((x) => x.id === item.id);
      if (!c) continue;
      bucketIdsNeeded.add(item.bucketId ?? c.bucketId);
    }

    const buckets = await prisma.planningBucket.findMany({
      where: {
        id: { in: [...bucketIdsNeeded] },
        organisationId: session.organisationId,
        userId: session.id,
        deletedAt: null,
      },
    });
    if (buckets.length !== bucketIdsNeeded.size) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }

    const bucketById = Object.fromEntries(buckets.map((b) => [b.id, b]));

    await prisma.$transaction(
      items.map((item) => {
        const card = cards.find((c) => c.id === item.id)!;
        const targetBucketId = item.bucketId ?? card.bucketId;
        const bucket = bucketById[targetBucketId];
        const data: Record<string, unknown> = {
          sortOrder: item.sortOrder,
          bucketId: targetBucketId,
        };
        if (isDoneBucketName(bucket.name)) {
          data.status = "DONE";
          data.completedAt = new Date();
        } else if (card.status === "DONE") {
          data.status = "OPEN";
          data.completedAt = null;
        }
        return prisma.planningCard.update({
          where: { id: item.id },
          data,
        });
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
