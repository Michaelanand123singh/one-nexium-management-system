import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { organisationId: session.organisationId, userId: session.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
