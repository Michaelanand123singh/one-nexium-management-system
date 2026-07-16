import { NextRequest, NextResponse } from "next/server";
import { getSessionOr401 } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { canViewInfrastructure } from "@/lib/permissions";
import { getInfrastructureSummary } from "@/lib/aws-client";

/** Default current phase when org phases not available. */
const DEFAULT_CURRENT_PHASE = "Phase 1";

export async function GET(request: NextRequest) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const orgId = session.organisationId;
  const userId = session.id;

  const { searchParams } = new URL(request.url);
  const phaseParam = searchParams.get("phase") ?? undefined;

  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    select: { phases: true },
  });
  const phases = Array.isArray(org?.phases) ? org.phases : [];
  const currentPhase: string =
    phaseParam ?? (typeof phases[0] === "string" ? phases[0] : null) ?? DEFAULT_CURRENT_PHASE;

  const roadmapWhere = phaseParam
    ? { organisationId: orgId, deletedAt: null, targetPhase: phaseParam }
    : { organisationId: orgId, deletedAt: null };

  const [
    roadmapCounts,
    roadmapRecent,
    backlogCount,
    backlogRecent,
    sprints,
    tasksInActiveSprint,
    myTasks,
    bugCounts,
    bugsRecent,
    okrCount,
    okrsRecent,
    unreadNotifications,
    notificationsRecent,
    featureRequestsPending,
  ] = await Promise.all([
    // Roadmap: count by status + recent 5 (optionally scoped to phase)
    prisma.roadmapItem.groupBy({
      by: ["status"],
      where: roadmapWhere,
      _count: true,
    }),
    prisma.roadmapItem.findMany({
      where: roadmapWhere,
      select: { id: true, title: true, status: true, targetPhase: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    // Backlog total
    prisma.backlogItem.count({
      where: { organisationId: orgId, deletedAt: null },
    }),
    prisma.backlogItem.findMany({
      where: { organisationId: orgId, deletedAt: null },
      select: { id: true, title: true, status: true, type: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    // Sprints (for active)
    prisma.sprint.findMany({
      where: { organisationId: orgId, deletedAt: null, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      take: 1,
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    // Task count in active sprint
    prisma.sprint
      .findFirst({
        where: { organisationId: orgId, deletedAt: null, status: "ACTIVE" },
        select: { id: true },
      })
      .then((s) =>
        s
          ? prisma.task.count({
              where: { organisationId: orgId, deletedAt: null, sprintId: s.id },
            })
          : 0
      ),
    // My tasks (assigned to current user)
    prisma.task.findMany({
      where: {
        organisationId: orgId,
        deletedAt: null,
        assigneeId: userId,
        status: { not: "DONE" },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        sprintId: true,
        sprint: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    // Bugs: open count (not CLOSED / WONT_FIX)
    prisma.bug.groupBy({
      by: ["status"],
      where: {
        organisationId: orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "WONT_FIX"] },
      },
      _count: true,
    }),
    prisma.bug.findMany({
      where: {
        organisationId: orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "WONT_FIX"] },
      },
      select: { id: true, title: true, severity: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    // OKRs current phase
    prisma.okr.count({
      where: { organisationId: orgId, deletedAt: null, period: currentPhase },
    }),
    prisma.okr.findMany({
      where: { organisationId: orgId, deletedAt: null, period: currentPhase },
      select: { id: true, objective: true, level: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    // Notifications unread
    prisma.notification.count({
      where: { organisationId: orgId, userId, read: false },
    }),
    prisma.notification.findMany({
      where: { organisationId: orgId, userId },
      select: { id: true, type: true, title: true, read: true, link: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Feature requests pending
    prisma.featureRequest.count({
      where: { organisationId: orgId, deletedAt: null, status: "PENDING" },
    }),
  ]);

  const roadmapTotal = roadmapCounts.reduce((a, g) => a + g._count, 0);
  const roadmapInProgress =
    roadmapCounts.find((g) => g.status === "IN_PROGRESS")?._count ?? 0;
  const openBugsCount = bugCounts.reduce((a, g) => a + g._count, 0);
  const activeSprint = sprints[0] ?? null;

  let infrastructureSummary: Awaited<ReturnType<typeof getInfrastructureSummary>> | null = null;
  if (canViewInfrastructure(session.role)) {
    try {
      infrastructureSummary = await getInfrastructureSummary();
    } catch {
      infrastructureSummary = { configured: false, ec2Running: 0, ec2Stopped: 0, rdsStatus: null, redisStatus: null, alarmsOk: 0, alarmsAlarm: 0, alarmsInsufficient: 0 };
    }
  }

  return NextResponse.json({
    stats: {
      roadmapTotal,
      roadmapInProgress,
      backlogTotal: backlogCount,
      activeSprint: activeSprint
        ? { ...activeSprint, taskCount: tasksInActiveSprint }
        : null,
      openBugsCount,
      okrCount,
      unreadNotifications,
      featureRequestsPending,
    },
    recent: {
      roadmap: roadmapRecent,
      backlog: backlogRecent,
      bugs: bugsRecent,
      okrs: okrsRecent,
      notifications: notificationsRecent,
    },
    myTasks,
    infrastructureSummary,
  });
}
