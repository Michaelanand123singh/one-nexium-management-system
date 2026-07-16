import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
});

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  joiningDate: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  ownerUserId: z.string().optional(),
  formDataJson: z.unknown().optional(),
  formTemplateJson: z.unknown().optional(),
  selfServe: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { canViewHr } = await import("@/lib/permissions");
  // Eng Lead may view the list; create/update still requires canManageOnboarding.
  if (!canViewHr(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const { searchParams } = url;
  const parsed = listQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { status, search } = parsed.data;

  const where: {
    organisationId: string;
    deletedAt: null;
    status?: string;
    OR?: { fullName?: { contains: string; mode: "insensitive" }; email?: { contains: string; mode: "insensitive" } }[];
  } = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const onboardings = await prisma.onboarding.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { id: true, fullName: true } },
      owner: { select: { id: true, name: true, email: true } },
      documents: {
        select: { id: true, type: true },
      },
    },
  });

  const origin = url.origin;

  const shaped = onboardings.map((o) => ({
    id: o.id,
    fullName: o.fullName,
    email: o.email,
    phone: o.phone,
    joiningDate: o.joiningDate,
    jobTitle: o.jobTitle,
    department: o.department,
    location: o.location,
    status: o.status,
    ownerUserId: o.ownerUserId,
    employee: o.employee
      ? { id: o.employee.id, fullName: o.employee.fullName }
      : null,
    owner: o.owner
      ? { id: o.owner.id, name: o.owner.name, email: o.owner.email }
      : null,
    documentsCount: o.documents.length,
    publicUrl: o.publicToken ? `${origin}/hr/onboarding/${o.publicToken}` : null,
    formTemplateJson: o.formTemplateJson,
    formDataJson: o.formDataJson,
  }));

  return NextResponse.json(shaped);
}

export async function POST(request: NextRequest) {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const publicToken = data.selfServe ? crypto.randomUUID().replace(/-/g, "") : null;

  const onboarding = await prisma.onboarding.create({
    data: {
      organisationId: session.organisationId,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone ?? null,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
      jobTitle: data.jobTitle ?? null,
      department: data.department ?? null,
      location: data.location ?? null,
      status: "DRAFT",
      createdByUserId: session.id,
      ownerUserId: data.ownerUserId ?? null,
      publicToken,
      formDataJson: (data.formDataJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      formTemplateJson: (data.formTemplateJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  const origin = new URL(request.url).origin;
  const publicUrl =
    publicToken != null ? `${origin}/hr/onboarding/${publicToken}` : null;

  return NextResponse.json({ onboarding, publicUrl });
}

