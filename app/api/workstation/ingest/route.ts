import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashIngestToken } from "@/lib/workstation-token";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const sampleSchema = z.object({
  sampledAt: z.string(),
  processName: z.string().min(1).max(512),
  windowTitle: z.string().max(2048).nullable().optional(),
  idle: z.boolean(),
  inProjectRoots: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ingestBodySchema = z.object({
  hostname: z.string().max(256).optional(),
  agentVersion: z.string().max(64).optional(),
  samples: z.array(sampleSchema).min(1).max(500),
});

function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length > 0 ? t : null;
}

export async function POST(request: NextRequest) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ingestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = hashIngestToken(token);
  const device = await prisma.workstationDevice.findFirst({
    where: { tokenHash, revoked: false },
  });

  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { hostname, agentVersion, samples } = parsed.data;
  const now = new Date();

  const rows: Prisma.WorkstationActivitySampleCreateManyInput[] = [];

  for (const s of samples) {
    const sampledAt = new Date(s.sampledAt);
    if (Number.isNaN(sampledAt.getTime())) {
      return NextResponse.json({ error: "Invalid sampledAt in one or more samples" }, { status: 400 });
    }
    const meta = s.metadata as Record<string, unknown> | undefined;
    const row: Prisma.WorkstationActivitySampleCreateManyInput = {
      organisationId: device.organisationId,
      deviceId: device.id,
      sampledAt,
      processName: s.processName,
      windowTitle: s.windowTitle ?? null,
      idle: s.idle,
      inProjectRoots: s.inProjectRoots ?? false,
      keyboardMouseRate:
        typeof meta?.keyboard_mouse_rate === "number"
          ? Math.round(meta.keyboard_mouse_rate)
          : null,
      appSwitchCount:
        typeof meta?.app_switch_count === "number"
          ? Math.round(meta.app_switch_count)
          : null,
    };
    if (meta !== undefined) {
      row.metadata = meta as Prisma.InputJsonValue;
    }
    rows.push(row);
  }

  await prisma.$transaction([
    prisma.workstationActivitySample.createMany({ data: rows }),
    prisma.workstationDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: now,
        hostnameLast: hostname ?? undefined,
        agentVersionLast: agentVersion ?? undefined,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, accepted: rows.length });
}
