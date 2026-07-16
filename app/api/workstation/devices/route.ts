import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageWorkstationDevices, canViewWorkstationTelemetry } from "@/lib/permissions";
import { generateIngestToken, hashIngestToken } from "@/lib/workstation-token";
import { z } from "zod";

const createSchema = z.object({
  userId: z.string().min(1),
  label: z.string().max(128).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewWorkstationTelemetry(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const devices = await prisma.workstationDevice.findMany({
    where: { organisationId: session.organisationId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      _count: { select: { samples: true } },
    },
  });

  return NextResponse.json(
    devices.map((d) => ({
      id: d.id,
      label: d.label,
      revoked: d.revoked,
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      hostnameLast: d.hostnameLast,
      agentVersionLast: d.agentVersionLast,
      user: d.user,
      sampleCount: d._count.samples,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkstationDevices(session.role)) {
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

  const { userId, label } = parsed.data;
  const member = await prisma.organisationMember.findUnique({
    where: {
      organisationId_userId: { organisationId: session.organisationId, userId },
    },
  });
  if (!member || member.status !== "ACTIVE") {
    return NextResponse.json({ error: "User is not an active member of this organisation" }, { status: 400 });
  }

  const plainToken = generateIngestToken();
  const tokenHash = hashIngestToken(plainToken);

  const device = await prisma.workstationDevice.create({
    data: {
      organisationId: session.organisationId,
      userId,
      label: label?.trim() || null,
      tokenHash,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({
    id: device.id,
    label: device.label,
    user: device.user,
    ingestToken: plainToken,
    message: "Save this token in the agent config; it will not be shown again.",
  });
}
