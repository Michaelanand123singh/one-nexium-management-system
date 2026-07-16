import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const readFilter = searchParams.get("read"); // "true" | "false" | omit for all

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    userId: session.id,
  };
  if (readFilter === "true") where.read = true;
  if (readFilter === "false") where.read = false;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(notifications);
}
