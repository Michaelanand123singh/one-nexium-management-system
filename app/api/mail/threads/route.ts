import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOr401 } from "@/lib/api-guard";

export async function GET(request: NextRequest) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") ?? "INBOX";
  const accountId = searchParams.get("accountId") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    mailAccount: {
      userId: session.id,
      deletedAt: null,
    },
    deletedAt: null,
  };

  if (folder) where.folder = folder;
  if (accountId) where.mailAccountId = accountId;
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { snippet: { contains: q, mode: "insensitive" } },
    ];
  }

  const threads = await prisma.mailThread.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    include: {
      mailAccount: {
        select: { id: true, email: true, displayName: true },
      },
    },
  });

  return NextResponse.json(threads);
}

