import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const row = await prisma.user.findFirst({
    where: { id: session.id, deletedAt: null },
    select: { passwordHash: true },
  });

  return NextResponse.json({
    user: {
      ...session,
      hasPassword: Boolean(row?.passwordHash),
    },
  });
}
