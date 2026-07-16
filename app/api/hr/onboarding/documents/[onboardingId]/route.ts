import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  type: z.string(),
  fileUrl: z.string().url(),
  fileName: z.string(),
  mimeType: z.string().optional(),
  fileSize: z.number().int().optional(),
});

type Params = {
  params: { onboardingId: string };
};

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { canManageOnboarding } = await import("@/lib/permissions");
  if (!canManageOnboarding(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const onboarding = await prisma.onboarding.findFirst({
    where: {
      id: params.onboardingId,
      organisationId: session.organisationId,
      deletedAt: null,
    },
  });
  if (!onboarding) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const docs = await prisma.onboardingDocument.findMany({
    where: {
      organisationId: session.organisationId,
      onboardingId: onboarding.id,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(docs);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { canManageOnboarding } = await import("@/lib/permissions");
  if (!canManageOnboarding(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const onboarding = await prisma.onboarding.findFirst({
    where: {
      id: params.onboardingId,
      organisationId: session.organisationId,
      deletedAt: null,
    },
  });
  if (!onboarding) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const doc = await prisma.onboardingDocument.create({
    data: {
      organisationId: session.organisationId,
      onboardingId: onboarding.id,
      type: data.type,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      mimeType: data.mimeType ?? null,
      fileSize: data.fileSize ?? null,
      uploadedByUserId: session.id,
    },
  });

  return NextResponse.json(doc);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { canManageOnboarding } = await import("@/lib/permissions");
  if (!canManageOnboarding(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const doc = await prisma.onboardingDocument.findFirst({
    where: {
      id,
      onboardingId: params.onboardingId,
      organisationId: session.organisationId,
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.onboardingDocument.delete({
    where: { id: doc.id },
  });

  return NextResponse.json({ ok: true });
}

