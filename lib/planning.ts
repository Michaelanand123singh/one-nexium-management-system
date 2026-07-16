import { prisma } from "@/lib/db";

/** Default columns for a new personal planning board (whiteboard-style). */
export const PLANNING_DEFAULT_BUCKET_NAMES = [
  "Ideas",
  "This week",
  "Waiting",
  "Done",
] as const;

export function isDoneBucketName(name: string): boolean {
  return name.trim().toLowerCase() === "done";
}

export function isThisWeekBucketName(name: string): boolean {
  return name.trim().toLowerCase() === "this week";
}

/** Parse YYYY-MM-DD to UTC midnight (date-only semantics). */
export function utcMidnightFromDateKey(dateKey: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Invalid date key");
  }
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function startEndUtcDay(dateKey: string): { start: Date; end: Date } {
  const start = utcMidnightFromDateKey(dateKey);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Ensures the user has at least the default buckets; creates them in one transaction if missing.
 */
export async function ensurePlanningBuckets(
  organisationId: string,
  userId: string
) {
  const existing = await prisma.planningBucket.findMany({
    where: { organisationId, userId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length > 0) return existing;

  const now = new Date();
  await prisma.$transaction(
    PLANNING_DEFAULT_BUCKET_NAMES.map((name, i) =>
      prisma.planningBucket.create({
        data: {
          organisationId,
          userId,
          name,
          sortOrder: i,
          updatedAt: now,
        },
      })
    )
  );

  return prisma.planningBucket.findMany({
    where: { organisationId, userId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}
