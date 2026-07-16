"use client";

import type { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Server,
  Database,
  HardDrive,
  Loader2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { useModuleData } from "@/hooks/use-module-data";
import { canManageInfrastructure } from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";

type EC2InstanceStatus = {
  instanceId: string;
  name: string;
  state: string;
  publicIp: string | null;
  privateIp: string | null;
  instanceType?: string;
};

type RDSStatus = {
  dbInstanceId: string;
  status: string;
  endpoint: string | null;
  engine: string;
  allocatedStorageGb: number;
};

type RedisStatus = {
  cacheClusterId: string;
  status: string;
  endpoint: string | null;
  nodeType: string;
  numCacheNodes: number;
};

type ALBTargetHealth = {
  loadBalancerName: string;
  targetGroupArn: string;
  healthyCount: number;
  unhealthyCount: number;
  targets: { id: string; port: number; health: string }[];
};

type CloudWatchAlarmState = {
  alarmName: string;
  state: string;
  reason?: string;
  updatedAt: string | null;
};

type InfrastructureStatus = {
  configured: boolean;
  error?: string;
  region: string;
  ec2: {
    platform: EC2InstanceStatus;
    runtime: EC2InstanceStatus;
  } | null;
  rds: RDSStatus | null;
  redis: RedisStatus | null;
  alb: ALBTargetHealth | null;
  alarms: CloudWatchAlarmState[];
  s3Bucket: string;
  ecrRepo: string;
};

function consoleUrl(
  path: string,
  region: string,
  params?: Record<string, string>
): string {
  const rest = { ...params };
  const q = Object.keys(rest).length
    ? `?${new URLSearchParams({ region, ...rest }).toString()}`
    : `?region=${region}`;
  return `https://${region}.console.aws.amazon.com${path}${q}`;
}

function EC2StateBadge({ state }: { state: string }) {
  const variant =
    state === "running"
      ? "default"
      : state === "stopped"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{state}</Badge>;
}

export function InfrastructureView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId;
  const { data, loading, error, refetch } = useModuleData<InfrastructureStatus>(
    "/api/infrastructure/status",
    { toastError: "Failed to load infrastructure status" }
  );
  const [actioning, setActioning] = useState<string | null>(null);
  const canManage = canManageInfrastructure(role);

  const handleEC2Action = async (instanceId: string, action: "start" | "stop") => {
    setActioning(instanceId);
    try {
      await api<{ instanceId: string; state: string }>(
        `/api/infrastructure/ec2/${instanceId}`,
        { method: "POST", body: { action } }
      );
      toast.success(`Instance ${action} initiated`);
      await refetch();
    } catch {
      toast.error(`Failed to ${action} instance`);
    } finally {
      setActioning(null);
    }
  };

  if (error) {
    return (
      <PageShell
        title="Infrastructure"
        description="AWS resources status and quick actions"
      >
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load infrastructure. Refresh the page or check that AWS is
            configured.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (loading || !data) {
    return (
      <PageShell
        title="Infrastructure"
        description="AWS resources status and quick actions"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </PageShell>
    );
  }

  if (!data.configured && data.error) {
    return (
      <PageShell
        title="Infrastructure"
        description="AWS resources status and quick actions"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        }
      >
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-muted-foreground">
              Infrastructure status is not available. Ensure AWS credentials and
              resource IDs are configured (see .env and Onenexium_aws_setup).
            </p>
            <p className="text-sm text-muted-foreground">{data.error}</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const ec2 = data.ec2;

  return (
    <PageShell
      title="Infrastructure"
      description={`Region: ${data.region} · OneNexium AWS resources`}
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        {/* EC2 */}
        {ec2 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4" />
                EC2 instances
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={consoleUrl("/ec2/home#Instances:", data.region)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in AWS Console <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {[ec2.platform, ec2.runtime].map((inst) => (
                <div
                  key={inst.instanceId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{inst.name}</span>
                      <EC2StateBadge state={inst.state} />
                      {inst.instanceType && (
                        <span className="text-xs text-muted-foreground">
                          {inst.instanceType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {inst.instanceId}
                      {inst.publicIp && ` · ${inst.publicIp}`}
                      {inst.privateIp && ` (private ${inst.privateIp})`}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      {inst.state === "stopped" && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={!!actioning}
                          onClick={() => handleEC2Action(inst.instanceId, "start")}
                        >
                          {actioning === inst.instanceId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Start"
                          )}
                        </Button>
                      )}
                      {inst.state === "running" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!actioning}
                          onClick={() => handleEC2Action(inst.instanceId, "stop")}
                        >
                          {actioning === inst.instanceId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Stop"
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* RDS */}
        {data.rds && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                RDS PostgreSQL
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={consoleUrl("/rds/home#database:", data.region)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in AWS Console <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    data.rds.status === "available" ? "default" : "secondary"
                  }
                >
                  {data.rds.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {data.rds.engine} · {data.rds.allocatedStorageGb} GB
                </span>
              </div>
              {data.rds.endpoint && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {data.rds.endpoint}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Redis */}
        {data.redis && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="h-4 w-4" />
                ElastiCache Redis
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={consoleUrl("/elasticache/home#/clusters", data.region)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in AWS Console <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    data.redis.status === "available" ? "default" : "secondary"
                  }
                >
                  {data.redis.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {data.redis.nodeType} · {data.redis.numCacheNodes} node(s)
                </span>
              </div>
              {data.redis.endpoint && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {data.redis.endpoint}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ALB */}
        {data.alb && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Load balancer · Platform target group
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={consoleUrl("/ec2/home#TargetGroup:", data.region)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in AWS Console <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {data.alb.healthyCount} healthy
                  </span>
                  {data.alb.unhealthyCount > 0 && (
                    <span className="ml-2 font-medium text-destructive">
                      {data.alb.unhealthyCount} unhealthy
                    </span>
                  )}
                </span>
                {data.alb.targets.length > 0 && (
                  <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {data.alb.targets.map((t) => (
                      <li key={t.id}>
                        <span className="font-mono">{t.id}</span>:{t.port}{" "}
                        <Badge variant="outline" className="text-xs">
                          {t.health}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CloudWatch Alarms */}
        {data.alarms.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4" />
                CloudWatch alarms
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={consoleUrl("/cloudwatch/home#alarmsV2:", data.region)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in AWS Console <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.alarms.map((a) => (
                  <li
                    key={a.alarmName}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
                  >
                    <span className="font-mono text-sm">{a.alarmName}</span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          a.state === "OK"
                            ? "default"
                            : a.state === "ALARM"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {a.state}
                      </Badge>
                      {a.updatedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.updatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* S3 & ECR */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage & registry</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">S3 bucket</span>
              <p className="font-mono">{data.s3Bucket}</p>
            </div>
            <div>
              <span className="text-muted-foreground">ECR repository</span>
              <p className="font-mono">{data.ecrRepo}</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://s3.console.aws.amazon.com/s3/home?region=ap-south-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                S3 Console <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href={consoleUrl("/ecr/repositories", data.region)}
                target="_blank"
                rel="noopener noreferrer"
              >
                ECR Console <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
