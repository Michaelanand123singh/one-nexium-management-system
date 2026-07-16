import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  joiningDate: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  ownerUserId: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  formDataJson: z.unknown().optional(),
  formTemplateJson: z.unknown().optional(),
});

type Params = {
  params: { id: string };
};

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { canViewHr, canViewOwnOnboarding } = await import("@/lib/permissions");

  const onboarding = await prisma.onboarding.findFirst({
    where: {
      id: params.id,
      organisationId: session.organisationId,
      deletedAt: null,
    },
    include: {
      employee: true,
      owner: { select: { id: true, name: true, email: true } },
      documents: true,
    },
  });

  if (!onboarding) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canView =
    canViewHr(session.role) ||
    (canViewOwnOnboarding(session.role) && onboarding.ownerUserId === session.id);

  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(onboarding);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { canManageOnboarding } = await import("@/lib/permissions");
  if (!canManageOnboarding(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.onboarding.findFirst({
    where: {
      id: params.id,
      organisationId: session.organisationId,
      deletedAt: null,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.onboarding.update({
    where: { id: existing.id },
    data: {
      fullName: data.fullName ?? existing.fullName,
      email: data.email ?? existing.email,
      phone: data.phone ?? existing.phone,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : existing.joiningDate,
      jobTitle: data.jobTitle ?? existing.jobTitle,
      department: data.department ?? existing.department,
      location: data.location ?? existing.location,
      status: data.status ?? existing.status,
      ownerUserId:
        data.ownerUserId !== undefined ? data.ownerUserId : existing.ownerUserId,
      employeeId:
        data.employeeId !== undefined ? data.employeeId : existing.employeeId,
      formDataJson:
        (data.formDataJson !== undefined
          ? data.formDataJson
          : existing.formDataJson) as Prisma.InputJsonValue,
      formTemplateJson:
        (data.formTemplateJson !== undefined
          ? data.formTemplateJson
          : existing.formTemplateJson) as Prisma.InputJsonValue,
    },
    include: {
      employee: true,
      owner: { select: { id: true, name: true, email: true } },
      documents: true,
    },
  });

  return NextResponse.json(updated);
}

