"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@prisma/client";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Zap,
  ListChecks,
  Bug,
  Target,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────

type MilestoneData = {
  id: string;
  name: string;
  targetDate: string | null;
  description: string | null;
};

type SprintData = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  tasksTotal: number;
  tasksDone: number;
  pointsTotal: number;
  pointsDone: number;
};

type OkrData = {
  id: string;
  objective: string;
  period: string;
  level: string;
  owner: { name: string | null } | null;
  keyResults: {
    id: string;
    metricName: string;
    currentValue: number;
    targetValue: number;
    unit: string | null;
    progress: number;
    confidence: string;
  }[];
};

type PipelineData = {
  milestones: MilestoneData[];
  sprints: SprintData[];
  roadmap: {
    byStatus: { PLANNED: number; IN_PROGRESS: number; SHIPPED: number; CANCELLED: number };
    byPhase: { phase: string; PLANNED: number; IN_PROGRESS: number; SHIPPED: number; CANCELLED: number }[];
  };
  okrs: OkrData[];
  backlog: Record<string, number>;
  bugs: {
    byStatus: Record<string, number>;
    bySeverity: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
  };
  tasksSummary: { total: number; done: number; pointsTotal: number; pointsDone: number };
};

// ─── Main View ─────────────────────────────────────────────────

export function PipelineView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void role;
  void organisationId;
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    api<PipelineData>("/api/pipeline")
      .then(setData)
      .catch(() => {
        setError(true);
        toast.error("Failed to load pipeline data");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <PageShell title="Pipeline" description="Visual journey from start to current state">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="Pipeline" description="Visual journey from start to current state">
        <EmptyState
          title="Couldn’t load pipeline"
          description="Something went wrong fetching journey metrics. Try again."
          action={
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="Pipeline" description="Visual journey from start to current state">
      <div className="space-y-8">
        <JourneyOverview data={data} />
        <MilestoneTimeline milestones={data.milestones} />
        <SprintPipeline sprints={data.sprints} />
        <RoadmapFunnel roadmap={data.roadmap} />
        <OkrProgress okrs={data.okrs} />
        <HealthMetrics bugs={data.bugs} backlog={data.backlog} />
      </div>
    </PageShell>
  );
}

// ─── Section 1: Journey Overview ───────────────────────────────

function JourneyOverview({ data }: { data: PipelineData }) {
  const { roadmap, tasksSummary, backlog, bugs } = data;
  const roadmapTotal = roadmap.byStatus.PLANNED + roadmap.byStatus.IN_PROGRESS + roadmap.byStatus.SHIPPED + roadmap.byStatus.CANCELLED;
  const roadmapPct = roadmapTotal > 0 ? Math.round((roadmap.byStatus.SHIPPED / roadmapTotal) * 100) : 0;
  const velocityPct = tasksSummary.pointsTotal > 0 ? Math.round((tasksSummary.pointsDone / tasksSummary.pointsTotal) * 100) : 0;
  const backlogTotal = Object.values(backlog).reduce((a, b) => a + b, 0);
  const backlogDone = backlog["DONE"] ?? 0;
  const backlogPct = backlogTotal > 0 ? Math.round((backlogDone / backlogTotal) * 100) : 0;
  const bugsTotal = Object.values(bugs.byStatus).reduce((a, b) => a + b, 0);
  const bugsResolved = (bugs.byStatus["FIXED"] ?? 0) + (bugs.byStatus["VERIFIED"] ?? 0) + (bugs.byStatus["CLOSED"] ?? 0);
  const bugsPct = bugsTotal > 0 ? Math.round((bugsResolved / bugsTotal) * 100) : 0;

  const allKrs = data.okrs.flatMap((o) => o.keyResults);
  const okrAvg = allKrs.length > 0 ? Math.round(allKrs.reduce((a, kr) => a + kr.progress, 0) / allKrs.length) : 0;

  const stats = [
    { label: "Roadmap Shipped", value: `${roadmapPct}%`, sub: `${roadmap.byStatus.SHIPPED} of ${roadmapTotal}`, icon: TrendingUp, color: "text-green-500" },
    { label: "Sprint Velocity", value: `${velocityPct}%`, sub: `${tasksSummary.pointsDone} / ${tasksSummary.pointsTotal} pts`, icon: Zap, color: "text-blue-500" },
    { label: "Backlog Done", value: `${backlogPct}%`, sub: `${backlogDone} of ${backlogTotal}`, icon: ListChecks, color: "text-violet-500" },
    { label: "Bugs Resolved", value: `${bugsPct}%`, sub: `${bugsResolved} of ${bugsTotal}`, icon: Bug, color: "text-amber-500" },
    { label: "OKR Progress", value: `${okrAvg}%`, sub: `${allKrs.length} key results`, icon: Target, color: "text-rose-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-2">
              <s.icon className={cn("h-4 w-4", s.color)} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <span className="text-2xl font-bold">{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.sub}</span>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
              <div
                className={cn("h-1.5 rounded-full transition-all", {
                  "bg-green-500": parseInt(s.value) >= 70,
                  "bg-amber-500": parseInt(s.value) >= 40 && parseInt(s.value) < 70,
                  "bg-red-500": parseInt(s.value) < 40,
                })}
                style={{ width: `${Math.min(parseInt(s.value) || 0, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Section 2: Milestone Timeline ─────────────────────────────

function MilestoneTimeline({ milestones }: { milestones: MilestoneData[] }) {
  if (milestones.length === 0) return null;
  const now = new Date();

  let youAreHereIndex = milestones.length;
  for (let i = 0; i < milestones.length; i++) {
    if (milestones[i].targetDate && new Date(milestones[i].targetDate!) > now) {
      youAreHereIndex = i;
      break;
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Milestone Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex items-center gap-0 py-4" style={{ minWidth: milestones.length * 180 }}>
            {milestones.map((m, i) => {
              const isPast = i < youAreHereIndex;
              const isCurrent = i === youAreHereIndex;
              const dateStr = m.targetDate
                ? new Date(m.targetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
                : "No date";

              return (
                <div key={m.id} className="flex items-center">
                  {i > 0 && (
                    <div className={cn("h-0.5 w-12 md:w-16", isPast ? "bg-green-500" : "bg-muted")} />
                  )}
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                        isPast && "border-green-500 bg-green-500/20",
                        isCurrent && "border-blue-500 bg-blue-500/20 ring-4 ring-blue-500/10",
                        !isPast && !isCurrent && "border-muted bg-muted/50"
                      )}
                    >
                      {isPast ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : isCurrent ? (
                        <Circle className="h-5 w-5 animate-pulse text-blue-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="max-w-[120px] text-center text-xs font-medium leading-tight">
                      {m.name}
                    </span>
                    <span className={cn(
                      "text-[10px]",
                      isPast ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                    )}>
                      {dateStr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section 3: Sprint Pipeline ────────────────────────────────

function SprintPipeline({ sprints }: { sprints: SprintData[] }) {
  if (sprints.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sprint Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex gap-3 py-2" style={{ minWidth: sprints.length * 200 }}>
            {sprints.map((s, i) => {
              const pct = s.tasksTotal > 0 ? Math.round((s.tasksDone / s.tasksTotal) * 100) : 0;
              const isCompleted = s.status === "COMPLETED";
              const isActive = s.status === "ACTIVE";
              const startStr = new Date(s.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
              const endStr = new Date(s.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

              return (
                <div key={s.id} className="flex items-center">
                  {i > 0 && (
                    <div className={cn(
                      "h-0.5 w-6 shrink-0",
                      isCompleted || sprints[i - 1]?.status === "COMPLETED" ? "bg-green-500" : "bg-muted"
                    )} />
                  )}
                  <div
                    className={cn(
                      "flex w-44 shrink-0 flex-col gap-2 rounded-lg border p-3 transition-all",
                      isCompleted && "border-green-500/40 bg-green-500/5",
                      isActive && "border-blue-500/40 bg-blue-500/5 ring-2 ring-blue-500/20",
                      !isCompleted && !isActive && "border-border bg-card"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">{s.name.replace(/Sprint Zero — /, "")}</span>
                      <Badge
                        variant={isCompleted ? "shipped" : isActive ? "inProgress" : "planned"}
                        className="shrink-0 text-[10px]"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{startStr} — {endStr}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Tasks</span>
                      <span className="font-medium">{s.tasksDone}/{s.tasksTotal}</span>
                      <span className="text-muted-foreground">Pts</span>
                      <span className="font-medium">{s.pointsDone}/{s.pointsTotal}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className={cn("h-1.5 rounded-full", isCompleted ? "bg-green-500" : isActive ? "bg-blue-500" : "bg-muted-foreground/30")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section 4: Roadmap Funnel ─────────────────────────────────

const ROADMAP_COLORS = {
  PLANNED: "hsl(var(--muted-foreground))",
  IN_PROGRESS: "hsl(217, 91%, 60%)",
  SHIPPED: "hsl(142, 71%, 45%)",
  CANCELLED: "hsl(0, 84%, 60%)",
};

function RoadmapFunnel({ roadmap }: { roadmap: PipelineData["roadmap"] }) {
  const { byPhase, byStatus } = roadmap;
  const total = byStatus.PLANNED + byStatus.IN_PROGRESS + byStatus.SHIPPED + byStatus.CANCELLED;

  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Roadmap by Phase</CardTitle>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Planned: {byStatus.PLANNED}</span>
            <span className="text-blue-500">In Progress: {byStatus.IN_PROGRESS}</span>
            <span className="text-green-500">Shipped: {byStatus.SHIPPED}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {byPhase.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byPhase} barCategoryGap="20%">
              <XAxis
                dataKey="phase"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "hsl(var(--foreground))",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="PLANNED" name="Planned" fill={ROADMAP_COLORS.PLANNED} radius={[2, 2, 0, 0]} stackId="a" />
              <Bar dataKey="IN_PROGRESS" name="In Progress" fill={ROADMAP_COLORS.IN_PROGRESS} radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="SHIPPED" name="Shipped" fill={ROADMAP_COLORS.SHIPPED} radius={[2, 2, 0, 0]} stackId="a" />
              <Bar dataKey="CANCELLED" name="Cancelled" fill={ROADMAP_COLORS.CANCELLED} radius={[2, 2, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No roadmap items with phases assigned.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 5: OKR Progress ───────────────────────────────────

const confidenceColor: Record<string, string> = {
  ON_TRACK: "bg-green-500",
  AT_RISK: "bg-amber-500",
  OFF_TRACK: "bg-red-500",
};
const confidenceText: Record<string, string> = {
  ON_TRACK: "text-green-600 dark:text-green-400",
  AT_RISK: "text-amber-600 dark:text-amber-400",
  OFF_TRACK: "text-red-600 dark:text-red-400",
};

function OkrProgress({ okrs }: { okrs: OkrData[] }) {
  if (okrs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">OKR Progress</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {okrs.map((okr) => {
          const avgProgress = okr.keyResults.length > 0
            ? Math.round(okr.keyResults.reduce((a, kr) => a + kr.progress, 0) / okr.keyResults.length)
            : 0;
          return (
            <Card key={okr.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm leading-snug">{okr.objective}</CardTitle>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{okr.level}</Badge>
                      <span>{okr.period}</span>
                      {okr.owner?.name && <span>· {okr.owner.name}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-lg font-bold">{avgProgress}%</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {okr.keyResults.map((kr) => (
                  <div key={kr.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-muted-foreground">{kr.metricName}</span>
                      <span className={cn("font-medium", confidenceText[kr.confidence] ?? "")}>
                        {kr.currentValue} / {kr.targetValue} {kr.unit ?? ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={cn("h-2 rounded-full transition-all", confidenceColor[kr.confidence] ?? "bg-muted-foreground")}
                        style={{ width: `${Math.min(kr.progress, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section 6: Health Metrics ──────────────────────────────────

const BUG_PIE_COLORS = ["hsl(0, 84%, 60%)", "hsl(25, 95%, 53%)", "hsl(45, 93%, 47%)", "hsl(142, 71%, 45%)"];
const BACKLOG_PIE_COLORS = [
  "hsl(var(--muted-foreground))",
  "hsl(217, 91%, 60%)",
  "hsl(263, 70%, 50%)",
  "hsl(199, 89%, 48%)",
  "hsl(142, 71%, 45%)",
  "hsl(0, 84%, 60%)",
];

function HealthMetrics({ bugs, backlog }: { bugs: PipelineData["bugs"]; backlog: Record<string, number> }) {
  const severityData = [
    { name: "Critical", value: bugs.bySeverity.CRITICAL },
    { name: "High", value: bugs.bySeverity.HIGH },
    { name: "Medium", value: bugs.bySeverity.MEDIUM },
    { name: "Low", value: bugs.bySeverity.LOW },
  ].filter((d) => d.value > 0);

  const backlogData = [
    { name: "New", value: backlog["NEW"] ?? 0 },
    { name: "Refined", value: backlog["REFINED"] ?? 0 },
    { name: "Groomed", value: backlog["GROOMED"] ?? 0 },
    { name: "In Sprint", value: backlog["IN_SPRINT"] ?? 0 },
    { name: "Done", value: backlog["DONE"] ?? 0 },
    { name: "Rejected", value: backlog["REJECTED"] ?? 0 },
  ].filter((d) => d.value > 0);

  if (severityData.length === 0 && backlogData.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Health Metrics</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {severityData.length > 0 && (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">Open Bugs by Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {severityData.map((_, idx) => (
                      <Cell key={idx} fill={BUG_PIE_COLORS[idx % BUG_PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {backlogData.length > 0 && (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">Backlog Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={backlogData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {backlogData.map((_, idx) => (
                      <Cell key={idx} fill={BACKLOG_PIE_COLORS[idx % BACKLOG_PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
