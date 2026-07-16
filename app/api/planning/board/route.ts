import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensurePlanningBuckets } from "@/lib/planning";
import { planningCardApiInclude } from "@/lib/planning-card-include";

/**
 * Full planning board for the current user: buckets with nested cards.
 * Creates default buckets on first visit.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensurePlanningBuckets(session.organisationId, session.id);

  const buckets = await prisma.planningBucket.findMany({
    where: {
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
    orderBy: { sortOrder: "asc" },
    include: {
      cards: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: planningCardApiInclude,
      },
    },
  });

  return NextResponse.json({ buckets });
}
