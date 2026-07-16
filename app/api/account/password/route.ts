import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getSession,
  hashPassword,
  verifyPassword,
  NEXIUM_SESSION_COOKIE,
  revokeOtherSessions,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { selfChangePasswordBodySchema } from "@/lib/auth/password-policy";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(NEXIUM_SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = selfChangePasswordBodySchema.parse(body);

    const user = await prisma.user.findFirst({
      where: { id: session.id, deletedAt: null },
      select: { id: true, passwordHash: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const hasPassword = Boolean(user.passwordHash);

    if (hasPassword) {
      const current = currentPassword?.trim() ?? "";
      if (!current) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 }
        );
      }
      const ok = await verifyPassword(current, user.passwordHash!);
      if (!ok) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await revokeOtherSessions(user.id, sessionToken);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
