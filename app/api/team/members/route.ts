import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.organisationMember.findMany({
    where: {
      organisationId: session.organisationId,
      status: "ACTIVE",
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });
  const users = members.map((m) => m.user);
  return NextResponse.json(users);
}
