"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { WorkstationAnalyticsPayload } from "@/lib/workstation-analytics";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLOR_TOTAL = "hsl(221, 83%, 53%)";
const COLOR_IN_PROJECT = "hsl(142, 71%, 45%)";
const COLOR_IDLE = "hsl(38, 92%, 50%)";
const COLOR_INPUT = "hsl(280, 65%, 60%)";

function formatBucketLabel(iso: string, bucket: "hour" | "day") {
  const d = new Date(iso);
  if (bucket === "day") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  title,
  value,
  suffix,
  sub,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  sub: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">
          {value}
          {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

export function WorkstationAnalyticsPanel({
  deviceId,
  rangeDays,
}: {
  deviceId: string;
  rangeDays: number;
}) {
  const [data, setData] = useState<WorkstationAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      const bucket = rangeDays <= 7 ? "hour" : "day";
      const params: Record<string, string> = {
        from: from.toISOString(),
        to: to.toISOString(),
        bucket,
      };
      if (deviceId !== "all") params.deviceId = deviceId;
      const res = await api<WorkstationAnalyticsPayload>("/api/workstation/analytics", { params });
      setData(res);
    } catch {
      toast.error("Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.summary.totalSamples === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No samples in this range. Agents store each check-in in the database; widen the date range or confirm
          devices are online.
        </CardContent>
      </Card>
    );
  }

  const s = data.summary;
  const hasInputData = s.avgInputRate != null;

  const chartData = data.timeSeries.map((p) => ({
    ...p,
    label: formatBucketLabel(p.bucket, data.range.bucket),
  }));

  const barData = data.topProcesses.map((p) => ({
    name: p.processName.length > 28 ? `${p.processName.slice(0, 26)}…` : p.processName,
    fullName: p.processName,
    count: p.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => void load()}
        >
          Refresh charts
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Samples in range"
          value={s.totalSamples.toLocaleString()}
          sub="Total check-ins stored in the database"
        />
        <StatCard
          title="Active hours"
          value={s.activeHours}
          sub="Distinct hours with non-idle activity"
        />
        <StatCard
          title="Idle share"
          value={`${s.pctIdle}%`}
          sub="Percentage of samples marked idle"
        />
        <StatCard
          title={'"In project" share'}
          value={`${s.pctInProject}%`}
          sub="Matched via agent project rules"
        />
        <StatCard
          title="Avg input rate"
          value={hasInputData ? (s.avgInputRate ?? "—") : "—"}
          suffix={hasInputData ? "/min" : undefined}
          sub="Keyboard + mouse events per minute"
        />
        <StatCard
          title="Avg app switches"
          value={hasInputData ? (s.avgAppSwitches ?? "—") : "—"}
          sub="Window changes per sample interval"
        />
        <StatCard
          title="Focus score"
          value={s.focusScore != null ? `${s.focusScore}%` : "—"}
          sub="Active input with low context switching"
        />
        <StatCard
          title="Meeting time"
          value={`${s.meetingPct}%`}
          sub="Samples with Teams / Zoom / Meet detected"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity over time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each point is aggregated {data.range.bucket === "hour" ? "hourly" : "daily"} from stored samples.
          </p>
        </CardHeader>
        <CardContent className="h-[340px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: hasInputData ? 48 : 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
              {hasInputData && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} label={{ value: "input/min", angle: -90, position: "insideRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              )}
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { bucket?: string } | undefined;
                  return row?.bucket ? new Date(row.bucket).toLocaleString() : "";
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="total" name="Samples" stroke={COLOR_TOTAL} strokeWidth={2} dot={false} yAxisId="left" />
              <Line type="monotone" dataKey="inProject" name="In project" stroke={COLOR_IN_PROJECT} strokeWidth={2} dot={false} yAxisId="left" />
              <Line type="monotone" dataKey="idle" name="Idle" stroke={COLOR_IDLE} strokeWidth={2} dot={false} yAxisId="left" />
              {hasInputData && (
                <Line
                  type="monotone"
                  dataKey="avgInputRate"
                  name="Avg input/min"
                  stroke={COLOR_INPUT}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                  yAxisId="right"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top foreground processes</CardTitle>
          <p className="text-sm text-muted-foreground">By sample count in the selected range.</p>
        </CardHeader>
        <CardContent className="h-[320px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 10 }}
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
                formatter={(value: number) => [value.toLocaleString(), "Samples"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                  return row?.fullName ?? "";
                }}
              />
              <Bar dataKey="count" name="Samples" fill={COLOR_TOTAL} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
