import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditBugs } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditBugs(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: bugId, attachmentId } = await params;
  const bug = await prisma.bug.findFirst({
    where: { id: bugId, organisationId: session.organisationId, deletedAt: null },
  });
  if (!bug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachment = await prisma.bugAttachment.findFirst({
    where: { id: attachmentId, bugId },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.bugAttachment.delete({
    where: { id: attachmentId },
  });
  return NextResponse.json({ ok: true });
}
