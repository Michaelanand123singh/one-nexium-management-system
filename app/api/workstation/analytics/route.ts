import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewWorkstationTelemetry } from "@/lib/permissions";
import type {
  WorkstationAnalyticsPayload,
  WorkstationTimeBucket,
} from "@/lib/workstation-analytics";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const querySchema = z.object({
  deviceId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  bucket: z.enum(["hour", "day"]).optional(),
});

type TsRow = {
  bucket: Date;
  total: bigint;
  idle: bigint;
  in_project: bigint;
  avg_input_rate: number | null;
  avg_app_switches: number | null;
};

type TopRow = {
  processName: string;
  count: bigint;
};

type SumRow = {
  total: bigint;
  idle: bigint;
  in_project: bigint;
  avg_input_rate: number | null;
  avg_app_switches: number | null;
  active_hours: bigint;
  focus_count: bigint;
  focus_eligible: bigint;
  meeting_count: bigint;
};

function num(b: bigint): number {
  return Number(b);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

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
    bucket: url.searchParams.get("bucket") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { deviceId, from, to } = parsed.data;
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 14 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(toDate.getTime()) || Number.isNaN(fromDate.getTime())) {
    return NextResponse.json({ error: "Invalid from or to date" }, { status: 400 });
  }

  if (fromDate > toDate) {
    return NextResponse.json({ error: "from must be before to" }, { status: 400 });
  }

  let bucket: WorkstationTimeBucket = parsed.data.bucket ?? "hour";
  const rangeMs = toDate.getTime() - fromDate.getTime();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  if (!parsed.data.bucket && rangeMs > fourteenDays) {
    bucket = "day";
  }

  if (deviceId) {
    const dev = await prisma.workstationDevice.findFirst({
      where: { id: deviceId, organisationId: session.organisationId },
    });
    if (!dev) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
  }

  const orgId = session.organisationId;
  const deviceFilter = deviceId
    ? Prisma.sql`AND s."deviceId" = ${deviceId}`
    : Prisma.empty;

  const timeSql =
    bucket === "hour"
      ? Prisma.sql`date_trunc('hour', s."sampledAt")`
      : Prisma.sql`date_trunc('day', s."sampledAt")`;

  const timeSeriesRows = await prisma.$queryRaw<TsRow[]>(Prisma.sql`
    SELECT
      ${timeSql} AS bucket,
      COUNT(*)::bigint AS total,
      COALESCE(SUM(CASE WHEN s.idle THEN 1 ELSE 0 END), 0)::bigint AS idle,
      COALESCE(SUM(CASE WHEN s."inProjectRoots" THEN 1 ELSE 0 END), 0)::bigint AS in_project,
      AVG(s."keyboardMouseRate")::float8 AS avg_input_rate,
      AVG(s."appSwitchCount")::float8 AS avg_app_switches
    FROM "WorkstationActivitySample" s
    WHERE s."organisationId" = ${orgId}
      AND s."sampledAt" >= ${fromDate}
      AND s."sampledAt" <= ${toDate}
      ${deviceFilter}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const [summaryRow] = await prisma.$queryRaw<SumRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS total,
      COALESCE(SUM(CASE WHEN s.idle THEN 1 ELSE 0 END), 0)::bigint AS idle,
      COALESCE(SUM(CASE WHEN s."inProjectRoots" THEN 1 ELSE 0 END), 0)::bigint AS in_project,
      AVG(s."keyboardMouseRate")::float8 AS avg_input_rate,
      AVG(s."appSwitchCount")::float8 AS avg_app_switches,
      (COUNT(DISTINCT date_trunc('hour', s."sampledAt")) FILTER (WHERE NOT s.idle))::bigint AS active_hours,
      (COUNT(*) FILTER (
        WHERE s."appSwitchCount" IS NOT NULL
          AND s."keyboardMouseRate" IS NOT NULL
          AND s."appSwitchCount" <= 2
          AND s."keyboardMouseRate" > 0
      ))::bigint AS focus_count,
      (COUNT(*) FILTER (
        WHERE s."appSwitchCount" IS NOT NULL AND s."keyboardMouseRate" IS NOT NULL
      ))::bigint AS focus_eligible,
      (COUNT(*) FILTER (
        WHERE s.metadata IS NOT NULL
          AND (s.metadata->>'in_meeting')::text = 'true'
      ))::bigint AS meeting_count
    FROM "WorkstationActivitySample" s
    WHERE s."organisationId" = ${orgId}
      AND s."sampledAt" >= ${fromDate}
      AND s."sampledAt" <= ${toDate}
      ${deviceFilter}
  `);

  const topRows = await prisma.$queryRaw<TopRow[]>(Prisma.sql`
    SELECT s."processName" AS "processName", COUNT(*)::bigint AS count
    FROM "WorkstationActivitySample" s
    WHERE s."organisationId" = ${orgId}
      AND s."sampledAt" >= ${fromDate}
      AND s."sampledAt" <= ${toDate}
      ${deviceFilter}
    GROUP BY s."processName"
    ORDER BY count DESC
    LIMIT 12
  `);

  const totalSamples = summaryRow ? num(summaryRow.total) : 0;
  const idleSamples = summaryRow ? num(summaryRow.idle) : 0;
  const inProjectSamples = summaryRow ? num(summaryRow.in_project) : 0;
  const focusEligible = summaryRow ? num(summaryRow.focus_eligible) : 0;
  const focusCount = summaryRow ? num(summaryRow.focus_count) : 0;
  const meetingCount = summaryRow ? num(summaryRow.meeting_count) : 0;

  const timeSeries = timeSeriesRows.map((r) => {
    const t = num(r.total);
    const idl = num(r.idle);
    const ip = num(r.in_project);
    const active = Math.max(0, t - idl);
    return {
      bucket: r.bucket.toISOString(),
      total: t,
      idle: idl,
      inProject: ip,
      active,
      inProjectPct: t > 0 ? round1((ip / t) * 100) : 0,
      avgInputRate: r.avg_input_rate != null ? round1(r.avg_input_rate) : null,
      avgAppSwitches: r.avg_app_switches != null ? round1(r.avg_app_switches) : null,
    };
  });

  const payload: WorkstationAnalyticsPayload = {
    range: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      bucket,
    },
    summary: {
      totalSamples,
      idleSamples,
      inProjectSamples,
      pctIdle: totalSamples > 0 ? round1((idleSamples / totalSamples) * 100) : 0,
      pctInProject: totalSamples > 0 ? round1((inProjectSamples / totalSamples) * 100) : 0,
      avgInputRate: summaryRow?.avg_input_rate != null ? round1(summaryRow.avg_input_rate) : null,
      avgAppSwitches:
        summaryRow?.avg_app_switches != null ? round1(summaryRow.avg_app_switches) : null,
      activeHours: summaryRow ? num(summaryRow.active_hours) : 0,
      focusScore: focusEligible > 0 ? round1((focusCount / focusEligible) * 100) : null,
      meetingPct: totalSamples > 0 ? round1((meetingCount / totalSamples) * 100) : 0,
    },
    timeSeries,
    topProcesses: topRows.map((r) => ({
      processName: r.processName,
      count: num(r.count),
    })),
  };

  return NextResponse.json(payload);
}
