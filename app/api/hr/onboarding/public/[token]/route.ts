import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const publicUpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  joiningDate: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  formDataJson: z.unknown().optional(),
});

type Params = {
  params: { token: string };
};

async function loadOnboardingByToken(token: string) {
  const onboarding = await prisma.onboarding.findFirst({
    where: {
      publicToken: token,
      deletedAt: null,
    },
    select: {
      id: true,
      organisationId: true,
      fullName: true,
      email: true,
      phone: true,
      joiningDate: true,
      jobTitle: true,
      department: true,
      location: true,
      status: true,
      formDataJson: true,
      formTemplateJson: true,
      publicExpiresAt: true,
    },
  });

  if (!onboarding) return null;
  if (
    onboarding.publicExpiresAt &&
    onboarding.publicExpiresAt.getTime() < Date.now()
  ) {
    return "expired" as const;
  }
  if (
    onboarding.status === "APPROVED" ||
    onboarding.status === "REJECTED" ||
    onboarding.status === "CANCELLED"
  ) {
    return "closed" as const;
  }
  return onboarding;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const onboarding = await loadOnboardingByToken(params.token);
  if (onboarding === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (onboarding === "expired") {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }
  if (onboarding === "closed") {
    return NextResponse.json({ error: "Onboarding closed" }, { status: 410 });
  }

  return NextResponse.json({
    id: onboarding.id,
    fullName: onboarding.fullName,
    email: onboarding.email,
    phone: onboarding.phone,
    joiningDate: onboarding.joiningDate,
    jobTitle: onboarding.jobTitle,
    department: onboarding.department,
    location: onboarding.location,
    status: onboarding.status,
    formDataJson: onboarding.formDataJson,
    formTemplateJson: onboarding.formTemplateJson,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const existing = await loadOnboardingByToken(params.token);
  if (existing === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing === "expired") {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }
  if (existing === "closed") {
    return NextResponse.json({ error: "Onboarding closed" }, { status: 410 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = publicUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const updated = await prisma.onboarding.update({
    where: { id: existing.id },
    data: {
      fullName: data.fullName ?? existing.fullName,
      phone: data.phone ?? existing.phone,
      joiningDate: data.joiningDate
        ? new Date(data.joiningDate)
        : existing.joiningDate,
      jobTitle: data.jobTitle ?? existing.jobTitle,
      department: data.department ?? existing.department,
      location: data.location ?? existing.location,
      // status: keep as-is; HR changes status internally
      formDataJson:
        data.formDataJson !== undefined
          ? data.formDataJson
          : existing.formDataJson,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      joiningDate: true,
      jobTitle: true,
      department: true,
      location: true,
      status: true,
      formDataJson: true,
    },
  });

  return NextResponse.json(updated);
}

