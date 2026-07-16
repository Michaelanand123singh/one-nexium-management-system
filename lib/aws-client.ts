/**
 * AWS API client for OneNexium infrastructure status and light actions.
 * Uses AWS SDK v3 with default credential chain (env, instance role, etc.).
 * All functions throw on credential or config errors; API routes catch and return 503.
 */
import { awsConfig } from "@/lib/aws-config";

// ─── Response types (used by API and UI) ───────────────────────────────────
export type EC2InstanceStatus = {
  instanceId: string;
  name: string;
  state: "pending" | "running" | "stopping" | "stopped" | "terminated" | "unknown";
  publicIp: string | null;
  privateIp: string | null;
  instanceType?: string;
};

export type RDSStatus = {
  dbInstanceId: string;
  status: string;
  endpoint: string | null;
  engine: string;
  allocatedStorageGb: number;
};

export type RedisStatus = {
  cacheClusterId: string;
  status: string;
  endpoint: string | null;
  nodeType: string;
  numCacheNodes: number;
};

export type ALBTargetHealth = {
  loadBalancerName: string;
  targetGroupArn: string;
  healthyCount: number;
  unhealthyCount: number;
  targets: { id: string; port: number; health: string }[];
};

export type CloudWatchAlarmState = {
  alarmName: string;
  state: "OK" | "ALARM" | "INSUFFICIENT_DATA";
  reason?: string;
  updatedAt: string | null;
};

export type InfrastructureStatus = {
  ec2: { platform: EC2InstanceStatus; runtime: EC2InstanceStatus };
  rds: RDSStatus | null;
  redis: RedisStatus | null;
  alb: ALBTargetHealth | null;
  alarms: CloudWatchAlarmState[];
  s3Bucket: string;
  ecrRepo: string;
  region: string;
  configured: boolean;
  error?: string;
};

// ─── Lazy SDK imports (server-only; avoid pulling into client bundle) ─────────
async function getEC2Client() {
  const { EC2Client, DescribeInstancesCommand } = await import(
    "@aws-sdk/client-ec2"
  );
  return { client: new EC2Client({ region: awsConfig.region }), DescribeInstancesCommand };
}

async function getRDSClient() {
  const { RDSClient, DescribeDBInstancesCommand } = await import(
    "@aws-sdk/client-rds"
  );
  return { client: new RDSClient({ region: awsConfig.region }), DescribeDBInstancesCommand };
}

async function getElastiCacheClient() {
  const { ElastiCacheClient, DescribeCacheClustersCommand } = await import(
    "@aws-sdk/client-elasticache"
  );
  return {
    client: new ElastiCacheClient({ region: awsConfig.region }),
    DescribeCacheClustersCommand,
  };
}

async function getELBv2Client() {
  const { ElasticLoadBalancingV2Client, DescribeTargetHealthCommand, DescribeLoadBalancersCommand } =
    await import("@aws-sdk/client-elastic-load-balancing-v2");
  return {
    client: new ElasticLoadBalancingV2Client({ region: awsConfig.region }),
    DescribeTargetHealthCommand,
    DescribeLoadBalancersCommand,
  };
}

async function getCloudWatchClient() {
  const { CloudWatchClient, DescribeAlarmsCommand } = await import(
    "@aws-sdk/client-cloudwatch"
  );
  return {
    client: new CloudWatchClient({ region: awsConfig.region }),
    DescribeAlarmsCommand,
  };
}

// ─── Fetch status ───────────────────────────────────────────────────────────
async function fetchEC2Instances(): Promise<{
  platform: EC2InstanceStatus;
  runtime: EC2InstanceStatus;
}> {
  const { client, DescribeInstancesCommand } = await getEC2Client();
  const res = await client.send(
    new DescribeInstancesCommand({
      InstanceIds: [
        awsConfig.ec2.platformInstanceId,
        awsConfig.ec2.runtimeInstanceId,
      ],
    })
  );

  const toStatus = (i: {
    InstanceId?: string;
    State?: { Name?: string };
    PublicIpAddress?: string;
    PrivateIpAddress?: string;
    InstanceType?: string;
    Tags?: { Key?: string; Value?: string }[];
  }): EC2InstanceStatus => {
    const name =
      i.Tags?.find((t) => t.Key === "Name")?.Value ?? i.InstanceId ?? "—";
    return {
      instanceId: i.InstanceId ?? "",
      name,
      state: (i.State?.Name?.toLowerCase() as EC2InstanceStatus["state"]) ?? "unknown",
      publicIp: i.PublicIpAddress ?? null,
      privateIp: i.PrivateIpAddress ?? null,
      instanceType: i.InstanceType,
    };
  };

  const instances = (res.Reservations ?? []).flatMap((r) => r.Instances ?? []);
  const platform =
    instances.find((i) => i.InstanceId === awsConfig.ec2.platformInstanceId) ??
    {
      InstanceId: awsConfig.ec2.platformInstanceId,
      State: { Name: "unknown" },
      Tags: [{ Key: "Name", Value: "Platform" }],
    };
  const runtime =
    instances.find((i) => i.InstanceId === awsConfig.ec2.runtimeInstanceId) ?? {
      InstanceId: awsConfig.ec2.runtimeInstanceId,
      State: { Name: "unknown" },
      Tags: [{ Key: "Name", Value: "Runtime" }],
    };

  return {
    platform: toStatus(platform as Parameters<typeof toStatus>[0]),
    runtime: toStatus(runtime as Parameters<typeof toStatus>[0]),
  };
}

async function fetchRDS(): Promise<RDSStatus | null> {
  const { client, DescribeDBInstancesCommand } = await getRDSClient();
  const res = await client.send(
    new DescribeDBInstancesCommand({
      DBInstanceIdentifier: awsConfig.rds.dbInstanceId,
    })
  );
  const db = res.DBInstances?.[0];
  if (!db) return null;
  const endpoint = db.Endpoint
    ? `${db.Endpoint.Address}:${db.Endpoint.Port ?? 5432}`
    : null;
  return {
    dbInstanceId: db.DBInstanceIdentifier ?? awsConfig.rds.dbInstanceId,
    status: db.DBInstanceStatus ?? "unknown",
    endpoint,
    engine: db.Engine ?? "postgres",
    allocatedStorageGb: db.AllocatedStorage ?? 0,
  };
}

async function fetchRedis(): Promise<RedisStatus | null> {
  const { client, DescribeCacheClustersCommand } = await getElastiCacheClient();
  const res = await client.send(
    new DescribeCacheClustersCommand({
      CacheClusterId: awsConfig.elasticache.cacheClusterId,
      ShowCacheNodeInfo: true,
    })
  );
  const cluster = res.CacheClusters?.[0];
  if (!cluster) return null;
  const endpoint = cluster.CacheNodes?.[0]?.Endpoint
    ? `${cluster.CacheNodes[0].Endpoint.Address}:${cluster.CacheNodes[0].Endpoint.Port ?? 6379}`
    : null;
  return {
    cacheClusterId: cluster.CacheClusterId ?? awsConfig.elasticache.cacheClusterId,
    status: cluster.CacheClusterStatus ?? "unknown",
    endpoint,
    nodeType: cluster.CacheNodeType ?? "—",
    numCacheNodes: cluster.NumCacheNodes ?? 0,
  };
}

async function fetchALBHealth(): Promise<ALBTargetHealth | null> {
  const { client, DescribeTargetHealthCommand } = await getELBv2Client();
  try {
    const res = await client.send(
      new DescribeTargetHealthCommand({
        TargetGroupArn: awsConfig.alb.platformTargetGroupArn,
      })
    );
    const targets = (res.TargetHealthDescriptions ?? []).map((t) => ({
      id: t.Target?.Id ?? "",
      port: t.Target?.Port ?? 0,
      health: t.TargetHealth?.State ?? "unknown",
    }));
    const healthyCount = targets.filter((t) => t.health === "healthy").length;
    const unhealthyCount = targets.filter((t) => t.health !== "healthy").length;
    return {
      loadBalancerName: awsConfig.alb.loadBalancerName,
      targetGroupArn: awsConfig.alb.platformTargetGroupArn,
      healthyCount,
      unhealthyCount,
      targets,
    };
  } catch {
    return null;
  }
}

async function fetchAlarms(): Promise<CloudWatchAlarmState[]> {
  if (awsConfig.cloudWatch.alarmNames.length === 0) return [];
  const { client, DescribeAlarmsCommand } = await getCloudWatchClient();
  const res = await client.send(
    new DescribeAlarmsCommand({
      AlarmNames: awsConfig.cloudWatch.alarmNames,
    })
  );
  return (res.MetricAlarms ?? []).map((a) => ({
    alarmName: a.AlarmName ?? "",
    state: (a.StateValue as CloudWatchAlarmState["state"]) ?? "INSUFFICIENT_DATA",
    reason: a.StateReason,
    updatedAt: a.StateUpdatedTimestamp?.toISOString() ?? null,
  }));
}

/** Aggregate infrastructure status. Throws if credentials/config invalid. */
export async function getInfrastructureStatus(): Promise<InfrastructureStatus> {
  const [ec2, rds, redis, alb, alarms] = await Promise.all([
    fetchEC2Instances(),
    fetchRDS(),
    fetchRedis(),
    fetchALBHealth(),
    fetchAlarms(),
  ]);

  return {
    ec2,
    rds,
    redis,
    alb,
    alarms,
    s3Bucket: awsConfig.s3.bucketName,
    ecrRepo: awsConfig.ecr.repositoryName,
    region: awsConfig.region,
    configured: true,
  };
}

/** Minimal summary for Command Centre widget. */
export type InfrastructureSummary = {
  ec2Running: number;
  ec2Stopped: number;
  rdsStatus: string | null;
  redisStatus: string | null;
  alarmsOk: number;
  alarmsAlarm: number;
  alarmsInsufficient: number;
  configured: boolean;
  error?: string;
};

export async function getInfrastructureSummary(): Promise<InfrastructureSummary> {
  const full = await getInfrastructureStatus();
  const ec2Running =
    (full.ec2.platform.state === "running" ? 1 : 0) +
    (full.ec2.runtime.state === "running" ? 1 : 0);
  const ec2Stopped =
    (full.ec2.platform.state === "stopped" ? 1 : 0) +
    (full.ec2.runtime.state === "stopped" ? 1 : 0);
  const alarmsOk = full.alarms.filter((a) => a.state === "OK").length;
  const alarmsAlarm = full.alarms.filter((a) => a.state === "ALARM").length;
  const alarmsInsufficient = full.alarms.filter(
    (a) => a.state === "INSUFFICIENT_DATA"
  ).length;

  return {
    ec2Running,
    ec2Stopped,
    rdsStatus: full.rds?.status ?? null,
    redisStatus: full.redis?.status ?? null,
    alarmsOk,
    alarmsAlarm,
    alarmsInsufficient,
    configured: true,
  };
}

/** Start or stop an EC2 instance. Throws on failure. */
export async function setEC2InstanceState(
  instanceId: string,
  action: "start" | "stop"
): Promise<{ instanceId: string; state: string }> {
  const { EC2Client, StartInstancesCommand, StopInstancesCommand } = await import(
    "@aws-sdk/client-ec2"
  );
  const client = new EC2Client({ region: awsConfig.region });
  const allowed = [
    awsConfig.ec2.platformInstanceId,
    awsConfig.ec2.runtimeInstanceId,
  ];
  if (!allowed.includes(instanceId)) {
    throw new Error("Instance not allowed");
  }
  if (action === "start") {
    await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
    return { instanceId, state: "pending" };
  }
  await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
  return { instanceId, state: "stopping" };
}
