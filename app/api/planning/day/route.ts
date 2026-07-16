import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isThisWeekBucketName,
  startEndUtcDay,
  utcMidnightFromDateKey,
} from "@/lib/planning";

const cardInclude = {
  task: { select: { id: true, title: true } },
  bucket: { select: { id: true, name: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
};

/**
 * Daily planning view: items scheduled for `date`, overdue OPEN items, and
 * unscheduled OPEN cards in the "This week" bucket (if that column exists).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateKey = searchParams.get("date");
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  }

  let dayStart: Date;
  try {
    dayStart = utcMidnightFromDateKey(dateKey);
  } catch {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const { start, end } = startEndUtcDay(dateKey);

  const base = {
    organisationId: session.organisationId,
    userId: session.id,
    deletedAt: null,
    status: "OPEN" as const,
  };

  const [scheduled, overdue, buckets] = await Promise.all([
    prisma.planningCard.findMany({
      where: {
        ...base,
        plannedDate: { gte: start, lt: end },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: cardInclude,
    }),
    prisma.planningCard.findMany({
      where: {
        ...base,
        plannedDate: { lt: dayStart },
      },
      orderBy: [{ plannedDate: "asc" }, { sortOrder: "asc" }],
      include: cardInclude,
    }),
    prisma.planningBucket.findMany({
      where: {
        organisationId: session.organisationId,
        userId: session.id,
        deletedAt: null,
      },
      select: { id: true, name: true },
    }),
  ]);

  const thisWeekBucket = buckets.find((b) => isThisWeekBucketName(b.name));
  let weekBucketUnscheduled: Awaited<ReturnType<typeof prisma.planningCard.findMany>> = [];
  if (thisWeekBucket) {
    weekBucketUnscheduled = await prisma.planningCard.findMany({
      where: {
        ...base,
        bucketId: thisWeekBucket.id,
        plannedDate: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: cardInclude,
    });
  }

  return NextResponse.json({
    date: dateKey,
    scheduled,
    overdue,
    weekBucketUnscheduled,
  });
}
