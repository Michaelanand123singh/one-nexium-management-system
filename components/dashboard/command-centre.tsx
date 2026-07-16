"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Map,
  Target,
  ListTodo,
  Kanban,
  Bug,
  Bell,
  FileText,
  ChevronRight,
  LayoutDashboard,
  Server,
} from "lucide-react";
import { useModuleData } from "@/hooks/use-module-data";
import { usePhase } from "@/lib/phase-context";
import { cn } from "@/lib/utils";
import { canEditSprint } from "@/lib/permissions";
import { canAccessModulePath } from "@/lib/route-access";

// ─── Dashboard API response types ────────────────────────────────────────
type DashboardStats = {
  roadmapTotal: number;
  roadmapInProgress: number;
  backlogTotal: number;
  activeSprint: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    taskCount: number;
  } | null;
  openBugsCount: number;
  okrCount: number;
  unreadNotifications: number;
  featureRequestsPending: number;
};

type RoadmapItem = { id: string; title: string; status: string; targetPhase: string | null };
type BacklogItem = { id: string; title: string; status: string; type: string };
type BugItem = { id: string; title: string; severity: string; status: string };
type OkrItem = { id: string; objective: string; level: string };
type NotificationItem = {
  id: string;
  type: string;
  title: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};
type MyTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  sprintId: string | null;
  sprint: { name: string } | null;
};

type InfrastructureSummary = {
  configured: boolean;
  ec2Running: number;
  ec2Stopped: number;
  rdsStatus: string | null;
  redisStatus: string | null;
  alarmsOk: number;
  alarmsAlarm: number;
  alarmsInsufficient: number;
  error?: string;
};

type DashboardData = {
  stats: DashboardStats;
  recent: {
    roadmap: RoadmapItem[];
    backlog: BacklogItem[];
    bugs: BugItem[];
    okrs: OkrItem[];
    notifications: NotificationItem[];
  };
  myTasks: MyTask[];
  infrastructureSummary?: InfrastructureSummary | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────
function formatDate(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function StatCard({
  title,
  value,
  sub,
  href,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  sub?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </>
  );
  return (
    <Card>
      <CardContent className="pt-4">
        {href ? (
          <Link href={href} className="block transition-opacity hover:opacity-90">
            {content}
          </Link>
        ) : (
          content
        )}
      </CardContent>
    </Card>
  );
}

export function CommandCentreDashboard({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId;
  const canCreateTasks = canEditSprint(role);
  const canOpenInfra = canAccessModulePath(role, "/infrastructure");
  const { selectedPhase } = usePhase();
  const { data, loading, error } = useModuleData<DashboardData>("/api/dashboard", {
    params: selectedPhase ? { phase: selectedPhase } : undefined,
    toastError: "Failed to load dashboard",
  });

  if (error) {
    return (
      <PageShell title="Command Centre" description="Your personalised dashboard">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load dashboard. Refresh the page or try again later.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Command Centre"
      description="Your personalised dashboard"
    >
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-8 w-12" />
              </CardContent>
            </Card>
          ))
        ) : data ? (
          <>
            <StatCard
              title="Roadmap items"
              value={data.stats.roadmapTotal}
              sub={`${data.stats.roadmapInProgress} in progress`}
              href="/roadmap"
              icon={Map}
            />
            <StatCard
              title="Backlog"
              value={data.stats.backlogTotal}
              href="/backlog"
              icon={ListTodo}
            />
            <StatCard
              title="Active sprint"
              value={
                data.stats.activeSprint
                  ? data.stats.activeSprint.taskCount
                  : "—"
              }
              sub={data.stats.activeSprint?.name ?? "No active sprint"}
              href="/sprint"
              icon={Kanban}
            />
            <StatCard
              title="Open bugs"
              value={data.stats.openBugsCount}
              href="/bugs"
              icon={Bug}
            />
            <StatCard
              title="OKRs (current phase)"
              value={data.stats.okrCount}
              href="/pipeline"
              icon={Target}
            />
            <StatCard
              title="Unread notifications"
              value={data.stats.unreadNotifications}
              href="/settings?tab=notifications"
              icon={Bell}
            />
            {canOpenInfra && data.infrastructureSummary?.configured && (
              <StatCard
                title="Infrastructure"
                value={`${data.infrastructureSummary.ec2Running} EC2 running`}
                sub={
                  data.infrastructureSummary.alarmsAlarm > 0
                    ? `${data.infrastructureSummary.alarmsAlarm} alarm(s)`
                    : "RDS · Redis · ALB"
                }
                href="/infrastructure"
                icon={Server}
              />
            )}
          </>
        ) : null}
      </div>

      {/* Quick actions + Feature requests (when PM/Lead) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutDashboard className="h-4 w-4" />
              Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canCreateTasks && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/sprint?new=task">
                  <Plus className="mr-2 h-4 w-4" />
                  Create task
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/backlog?new=feature">
                <ListTodo className="mr-2 h-4 w-4" />
                New feature request
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/roadmap">
                <Map className="mr-2 h-4 w-4" />
                View roadmap
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/pipeline">
                <Target className="mr-2 h-4 w-4" />
                View pipeline
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/bugs">
                <Bug className="mr-2 h-4 w-4" />
                Bug tracker
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/documents">
                <FileText className="mr-2 h-4 w-4" />
                Documents
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Getting started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Use the sidebar for Roadmap, Backlog, Sprint, Bugs, Documents, and more.
              Your role controls which modules and edit actions you see.
            </p>
            {data && data.stats.featureRequestsPending > 0 && (
              <p>
                <Link
                  href="/backlog"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {data.stats.featureRequestsPending} pending feature request
                  {data.stats.featureRequestsPending !== 1 ? "s" : ""}
                </Link>{" "}
                in the backlog.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My tasks */}
      {data && data.myTasks.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">My tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sprint">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.myTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/sprint${t.sprintId ? `?sprint=${t.sprintId}&task=${t.id}` : `?task=${t.id}`}`}
                    className="flex items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:border-border hover:bg-muted/50"
                  >
                    <span className="truncate font-medium">{t.title}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.sprint?.name && (
                        <Badge variant="secondary" className="text-xs">
                          {t.sprint.name}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          t.status === "IN_PROGRESS" && "border-primary/50 text-primary"
                        )}
                      >
                        {t.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recent items grid: Roadmap, Backlog, Bugs, OKRs, Notifications */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                <CardContent><Skeleton className="h-24 w-full" /></CardContent>
              </Card>
            ))}
          </>
        ) : (
          data && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Recent roadmap</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/roadmap">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.recent.roadmap.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No roadmap items yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.recent.roadmap.map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/roadmap?item=${r.id}`}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                          >
                            <span className="truncate">{r.title}</span>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {r.status}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Recent backlog</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/backlog">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.recent.backlog.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No backlog items yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.recent.backlog.map((b) => (
                        <li key={b.id}>
                          <Link
                            href={`/backlog?item=${b.id}`}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                          >
                            <span className="truncate">{b.title}</span>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {b.status}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Open bugs</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/bugs">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.recent.bugs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open bugs.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.recent.bugs.map((b) => (
                        <li key={b.id}>
                          <Link
                            href={`/bugs?bug=${b.id}`}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                          >
                            <span className="truncate">{b.title}</span>
                            <Badge
                              variant={b.severity === "CRITICAL" || b.severity === "HIGH" ? "destructive" : "secondary"}
                              className="shrink-0 text-xs"
                            >
                              {b.severity}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">OKRs this phase</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/pipeline">View pipeline</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.recent.okrs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No OKRs for this phase.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.recent.okrs.map((o) => (
                        <li key={o.id}>
                          <Link
                            href="/pipeline"
                            className="block rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                          >
                            <span className="line-clamp-2">{o.objective}</span>
                            <span className="text-xs text-muted-foreground">{o.level}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Notifications</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/settings?tab=notifications">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.recent.notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No notifications.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.recent.notifications.map((n) => (
                        <li key={n.id}>
                          <Link
                            href={n.link ?? "/settings?tab=notifications"}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50",
                              !n.read && "font-medium"
                            )}
                          >
                            <span className="truncate">{n.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(n.createdAt)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )
        )}
      </div>
    </PageShell>
  );
}
