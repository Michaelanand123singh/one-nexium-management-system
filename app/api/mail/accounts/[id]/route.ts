import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionOr401, notFound } from "@/lib/api-guard";

const updateSchema = z.object({
  displayName: z.string().optional(),
  provider: z.string().optional(),
  config: z.any().optional(),
  isPrimary: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const { id } = await params;

  const existing = await prisma.mailAccount.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });

  if (!existing) {
    return notFound("Mail account not found");
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    if (data.isPrimary) {
      await prisma.mailAccount.updateMany({
        where: {
          organisationId: session.organisationId,
          userId: session.id,
          deletedAt: null,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    const account = await prisma.mailAccount.update({
      where: { id: existing.id },
      data: {
        displayName: data.displayName ?? existing.displayName,
        provider: data.provider ?? existing.provider,
        config: data.config ?? existing.config,
        isPrimary: data.isPrimary ?? existing.isPrimary,
      },
    });

    return NextResponse.json(account);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update mail account" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const { id } = await params;

  const existing = await prisma.mailAccount.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });

  if (!existing) {
    return notFound("Mail account not found");
  }

  await prisma.mailAccount.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

