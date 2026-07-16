import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword, revokeAllSessionsForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { adminSetMemberPasswordBodySchema } from "@/lib/auth/password-policy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const member = await prisma.organisationMember.findFirst({
    where: { id, organisationId: session.organisationId },
    select: { userId: true },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (member.userId === session.id) {
    return NextResponse.json(
      { error: "Use Account settings to change your own password." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { newPassword } = adminSetMemberPasswordBodySchema.parse(body);

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: member.userId },
      data: { passwordHash },
    });

    await revokeAllSessionsForUser(member.userId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
  }
}
