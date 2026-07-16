import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  countActiveSuperAdmins,
  patchTeamMemberSchema,
  soleActiveSuperAdminBlocked,
  toTeamMemberApiRow,
} from "@/lib/settings/team-members";

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
  const existing = await prisma.organisationMember.findFirst({
    where: { id, organisationId: session.organisationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = patchTeamMemberSchema.parse(body);
    const updates: Record<string, unknown> = {};
    if (data.role !== undefined) updates.role = data.role;
    if (data.department !== undefined) updates.department = data.department;
    if (data.status !== undefined) updates.status = data.status;

    if (Object.keys(updates).length === 0) {
      const unchanged = await prisma.organisationMember.findFirst({
        where: { id, organisationId: session.organisationId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      if (!unchanged) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(toTeamMemberApiRow(unchanged));
    }

    const admins = await countActiveSuperAdmins(session.organisationId);
    const wouldDemoteSelf =
      existing.userId === session.id &&
      existing.role === "SUPER_ADMIN" &&
      existing.status === "ACTIVE" &&
      data.role !== undefined &&
      data.role !== "SUPER_ADMIN";
    const wouldDeactivateSelf =
      existing.userId === session.id &&
      existing.role === "SUPER_ADMIN" &&
      existing.status === "ACTIVE" &&
      data.status === "INACTIVE";

    if (
      (wouldDemoteSelf || wouldDeactivateSelf) &&
      soleActiveSuperAdminBlocked(existing, admins)
    ) {
      return NextResponse.json(
        { error: "Cannot change role or deactivate the only active Super Admin in this organisation." },
        { status: 400 }
      );
    }

    const demotingOtherSuperAdmin =
      existing.role === "SUPER_ADMIN" &&
      existing.status === "ACTIVE" &&
      data.role !== undefined &&
      data.role !== "SUPER_ADMIN";
    const deactivatingOtherSuperAdmin =
      existing.role === "SUPER_ADMIN" &&
      existing.status === "ACTIVE" &&
      data.status === "INACTIVE";

    if (
      (demotingOtherSuperAdmin || deactivatingOtherSuperAdmin) &&
      soleActiveSuperAdminBlocked(existing, admins)
    ) {
      return NextResponse.json(
        { error: "Cannot demote or deactivate the only active Super Admin in this organisation." },
        { status: 400 }
      );
    }

    const member = await prisma.organisationMember.update({
      where: { id },
      data: updates,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(toTeamMemberApiRow(member));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.organisationMember.findFirst({
    where: { id, organisationId: session.organisationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.userId === session.id) {
    return NextResponse.json(
      { error: "You cannot remove yourself from the organisation." },
      { status: 400 }
    );
  }

  const admins = await countActiveSuperAdmins(session.organisationId);
  if (soleActiveSuperAdminBlocked(existing, admins)) {
    return NextResponse.json(
      { error: "Cannot remove the only active Super Admin in this organisation." },
      { status: 400 }
    );
  }

  await prisma.organisationMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
