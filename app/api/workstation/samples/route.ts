import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewWorkstationTelemetry } from "@/lib/permissions";
import { z } from "zod";

const querySchema = z.object({
  deviceId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewWorkstationTelemetry(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    deviceId: url.searchParams.get("deviceId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { deviceId, from, to, limit } = parsed.data;
  const take = limit ?? 200;

  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(toDate.getTime()) || Number.isNaN(fromDate.getTime())) {
    return NextResponse.json({ error: "Invalid from or to date" }, { status: 400 });
  }

  const where: {
    organisationId: string;
    sampledAt: { gte: Date; lte: Date };
    deviceId?: string;
  } = {
    organisationId: session.organisationId,
    sampledAt: { gte: fromDate, lte: toDate },
  };

  if (deviceId) {
    const dev = await prisma.workstationDevice.findFirst({
      where: { id: deviceId, organisationId: session.organisationId },
    });
    if (!dev) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    where.deviceId = deviceId;
  }

  const samples = await prisma.workstationActivitySample.findMany({
    where,
    orderBy: { sampledAt: "desc" },
    take,
    include: {
      device: {
        select: {
          id: true,
          label: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(
    samples.map((s) => ({
      id: s.id,
      sampledAt: s.sampledAt.toISOString(),
      processName: s.processName,
      windowTitle: s.windowTitle,
      idle: s.idle,
      inProjectRoots: s.inProjectRoots,
      keyboardMouseRate: s.keyboardMouseRate,
      appSwitchCount: s.appSwitchCount,
      metadata: s.metadata,
      deviceId: s.deviceId,
      deviceLabel: s.device.label,
      userEmail: s.device.user.email,
      userName: s.device.user.name,
    }))
  );
}
