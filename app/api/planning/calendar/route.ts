import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Cards with a plannedDate in [monthStart, monthEnd] for calendar dots / lists.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? "", 10);
  const month = parseInt(searchParams.get("month") ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "year and month (1-12) required" }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEndExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const cards = await prisma.planningCard.findMany({
    where: {
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
      status: "OPEN",
      plannedDate: { gte: monthStart, lt: monthEndExclusive },
    },
    orderBy: [{ plannedDate: "asc" }, { sortOrder: "asc" }],
    include: {
      task: { select: { id: true, title: true } },
      bucket: { select: { id: true, name: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({ year, month, cards });
}
