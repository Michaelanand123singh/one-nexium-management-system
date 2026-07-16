import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { addTeamMemberSchema, toTeamMemberApiRow } from "@/lib/settings/team-members";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.organisationMember.findMany({
    where: { organisationId: session.organisationId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { joinedAt: "desc" }],
  });

  const list = members.map(toTeamMemberApiRow);
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, email, password, role, department } = addTeamMemberSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    let userId: string;

    if (existingUser) {
      const existingMember = await prisma.organisationMember.findUnique({
        where: {
          organisationId_userId: { organisationId: session.organisationId, userId: existingUser.id },
        },
      });
      if (existingMember) {
        return NextResponse.json(
          { error: "User is already in this organisation" },
          { status: 409 }
        );
      }
      userId = existingUser.id;
    } else {
      if (!password || password.length < PASSWORD_MIN_LENGTH) {
        return NextResponse.json(
          {
            error: `Password is required for new users (min ${PASSWORD_MIN_LENGTH} characters)`,
          },
          { status: 400 }
        );
      }
      const passwordHash = await hashPassword(password);
      const newUser = await prisma.user.create({
        data: {
          email,
          name: name || null,
          passwordHash,
        },
      });
      userId = newUser.id;
    }

    const member = await prisma.organisationMember.create({
      data: {
        organisationId: session.organisationId,
        userId,
        role,
        department: department ?? null,
        status: "ACTIVE",
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(toTeamMemberApiRow(member));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
  }
}
