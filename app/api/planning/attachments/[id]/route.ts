import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUsePlanning } from "@/lib/permissions";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const row = await prisma.planningCardAttachment.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      planningCard: {
        userId: session.id,
        deletedAt: null,
      },
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.planningCardAttachment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
