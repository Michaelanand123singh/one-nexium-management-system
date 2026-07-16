import { NextResponse } from "next/server";
import { getSessionOr401 } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

export async function GET() {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const orgId = session.organisationId;

  const [
    milestones,
    sprintsRaw,
    roadmapByStatus,
    roadmapByPhase,
    okrs,
    backlogByStatus,
    bugsByStatus,
    bugsBySeverity,
    tasksTotal,
    tasksDone,
  ] = await Promise.all([
    prisma.milestone.findMany({
      where: { organisationId: orgId, deletedAt: null },
      select: { id: true, name: true, targetDate: true, description: true },
      orderBy: { targetDate: "asc" },
    }),

    prisma.sprint.findMany({
      where: { organisationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "asc" },
    }),

    prisma.roadmapItem.groupBy({
      by: ["status"],
      where: { organisationId: orgId, deletedAt: null },
      _count: true,
    }),

    prisma.roadmapItem.groupBy({
      by: ["targetPhase", "status"],
      where: { organisationId: orgId, deletedAt: null, targetPhase: { not: null } },
      _count: true,
    }),

    prisma.okr.findMany({
      where: { organisationId: orgId, deletedAt: null },
      select: {
        id: true,
        objective: true,
        period: true,
        level: true,
        owner: { select: { name: true } },
        keyResults: {
          select: {
            id: true,
            metricName: true,
            currentValue: true,
            targetValue: true,
            unit: true,
            progress: true,
            confidence: true,
          },
        },
      },
      orderBy: [{ level: "asc" }, { updatedAt: "desc" }],
    }),

    prisma.backlogItem.groupBy({
      by: ["status"],
      where: { organisationId: orgId, deletedAt: null },
      _count: true,
    }),

    prisma.bug.groupBy({
      by: ["status"],
      where: { organisationId: orgId, deletedAt: null },
      _count: true,
    }),

    prisma.bug.groupBy({
      by: ["severity"],
      where: { organisationId: orgId, deletedAt: null, status: { notIn: ["CLOSED", "WONT_FIX"] } },
      _count: true,
    }),

    prisma.task.count({
      where: { organisationId: orgId, deletedAt: null },
    }),

    prisma.task.count({
      where: { organisationId: orgId, deletedAt: null, status: "DONE" },
    }),
  ]);

  // Compute per-sprint task stats
  const sprintIds = sprintsRaw.map((s) => s.id);
  const sprintTaskCounts = sprintIds.length > 0
    ? await prisma.task.groupBy({
        by: ["sprintId", "status"],
        where: { organisationId: orgId, deletedAt: null, sprintId: { in: sprintIds } },
        _count: true,
        _sum: { storyPoints: true },
      })
    : [];

  const sprints = sprintsRaw.map((s) => {
    const rows = sprintTaskCounts.filter((r) => r.sprintId === s.id);
    const tasksTotal = rows.reduce((a, r) => a + r._count, 0);
    const tasksDoneCount = rows.filter((r) => r.status === "DONE").reduce((a, r) => a + r._count, 0);
    const pointsTotal = rows.reduce((a, r) => a + (r._sum.storyPoints ?? 0), 0);
    const pointsDone = rows.filter((r) => r.status === "DONE").reduce((a, r) => a + (r._sum.storyPoints ?? 0), 0);
    return { ...s, tasksTotal, tasksDone: tasksDoneCount, pointsTotal, pointsDone };
  });

  // Roadmap by status map
  const roadmapStatusMap: Record<string, number> = {};
  for (const g of roadmapByStatus) {
    roadmapStatusMap[g.status] = g._count;
  }

  // Roadmap by phase
  const phaseMap = new Map<string, Record<string, number>>();
  for (const g of roadmapByPhase) {
    const p = g.targetPhase as string;
    if (!phaseMap.has(p)) phaseMap.set(p, {});
    phaseMap.get(p)![g.status] = g._count;
  }
  const roadmapPhases = Array.from(phaseMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([phase, counts]) => ({
      phase,
      PLANNED: counts["PLANNED"] ?? 0,
      IN_PROGRESS: counts["IN_PROGRESS"] ?? 0,
      SHIPPED: counts["SHIPPED"] ?? 0,
      CANCELLED: counts["CANCELLED"] ?? 0,
    }));

  // Backlog map
  const backlogMap: Record<string, number> = {};
  for (const g of backlogByStatus) {
    backlogMap[g.status] = g._count;
  }

  // Bug maps
  const bugStatusMap: Record<string, number> = {};
  for (const g of bugsByStatus) {
    bugStatusMap[g.status] = g._count;
  }
  const bugSeverityMap: Record<string, number> = {};
  for (const g of bugsBySeverity) {
    bugSeverityMap[g.severity] = g._count;
  }

  // Story points aggregate
  const [pointsAgg] = await prisma.task.groupBy({
    by: ["organisationId"],
    where: { organisationId: orgId, deletedAt: null },
    _sum: { storyPoints: true },
  }).then((r) => r.length ? r : [{ _sum: { storyPoints: 0 }, organisationId: orgId }]);

  const [pointsDoneAgg] = await prisma.task.groupBy({
    by: ["organisationId"],
    where: { organisationId: orgId, deletedAt: null, status: "DONE" },
    _sum: { storyPoints: true },
  }).then((r) => r.length ? r : [{ _sum: { storyPoints: 0 }, organisationId: orgId }]);

  return NextResponse.json({
    milestones,
    sprints,
    roadmap: {
      byStatus: {
        PLANNED: roadmapStatusMap["PLANNED"] ?? 0,
        IN_PROGRESS: roadmapStatusMap["IN_PROGRESS"] ?? 0,
        SHIPPED: roadmapStatusMap["SHIPPED"] ?? 0,
        CANCELLED: roadmapStatusMap["CANCELLED"] ?? 0,
      },
      byPhase: roadmapPhases,
    },
    okrs,
    backlog: {
      NEW: backlogMap["NEW"] ?? 0,
      REFINED: backlogMap["REFINED"] ?? 0,
      GROOMED: backlogMap["GROOMED"] ?? 0,
      IN_SPRINT: backlogMap["IN_SPRINT"] ?? 0,
      DONE: backlogMap["DONE"] ?? 0,
      REJECTED: backlogMap["REJECTED"] ?? 0,
    },
    bugs: {
      byStatus: bugStatusMap,
      bySeverity: {
        CRITICAL: bugSeverityMap["CRITICAL"] ?? 0,
        HIGH: bugSeverityMap["HIGH"] ?? 0,
        MEDIUM: bugSeverityMap["MEDIUM"] ?? 0,
        LOW: bugSeverityMap["LOW"] ?? 0,
      },
    },
    tasksSummary: {
      total: tasksTotal,
      done: tasksDone,
      pointsTotal: pointsAgg._sum.storyPoints ?? 0,
      pointsDone: pointsDoneAgg._sum.storyPoints ?? 0,
    },
  });
}
