import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditGtm } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;
  const audience = searchParams.get("audience") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (type) where.type = type;
  if (audience) where.audience = audience;

  const assets = await prisma.asset.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
  });
  return NextResponse.json(assets);
}

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional().nullable(),
  url: z.string().min(1),
  folder: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditGtm(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const asset = await prisma.asset.create({
      data: {
        organisationId: session.organisationId,
        name: data.name.trim(),
        type: data.type?.trim() ?? null,
        url: data.url.trim(),
        folder: data.folder?.trim() ?? null,
        audience: data.audience?.trim() ?? null,
      },
    });
    await prisma.document.create({
      data: {
        organisationId: session.organisationId,
        title: asset.name,
        fileUrl: asset.url,
        fileName: asset.url.split("/").pop() ?? null,
        sourceType: "gtm",
        sourceId: asset.id,
      } as Prisma.DocumentUncheckedCreateInput,
    });
    return NextResponse.json(asset);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
