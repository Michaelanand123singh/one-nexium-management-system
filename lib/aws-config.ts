/**
 * OneNexium AWS infrastructure resource identifiers.
 * Values come from env (e.g. from Onenexium_aws_setup/onenexium-infra-vars.env).
 * When not set, defaults match the documented setup in ap-south-1.
 */
const REGION = process.env.AWS_REGION ?? "ap-south-1";
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID ?? "268054298224";

export const awsConfig = {
  region: REGION,
  accountId: ACCOUNT_ID,

  ec2: {
    platformInstanceId:
      process.env.ONENEXIUM_PLATFORM_INSTANCE_ID ?? "i-081b6335b35bfb292",
    runtimeInstanceId:
      process.env.ONENEXIUM_RUNTIME_INSTANCE_ID ?? "i-054b26f20ec8c7658",
  },

  rds: {
    dbInstanceId:
      process.env.ONENEXIUM_RDS_INSTANCE_ID ?? "onenexium-platform-db",
  },

  elasticache: {
    cacheClusterId:
      process.env.ONENEXIUM_REDIS_CLUSTER_ID ?? "onenexium-redis",
  },

  alb: {
    loadBalancerName: process.env.ONENEXIUM_ALB_NAME ?? "onenexium-alb",
    platformTargetGroupArn:
      process.env.ONENEXIUM_PLATFORM_TG_ARN ??
      `arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT_ID}:targetgroup/onenexium-platform-tg/c214d4051da77a39`,
  },

  cloudWatch: {
    alarmNames: (
      process.env.ONENEXIUM_ALARM_NAMES ??
      "platform-cpu-high,rds-cpu-high,rds-storage-low,rds-connections-high,redis-memory-high"
    ).split(","),
  },

  s3: {
    bucketName:
      process.env.ONENEXIUM_S3_BUCKET_NAME ?? "onenexium-storage-268054298224",
  },

  ecr: {
    repositoryName: process.env.ONENEXIUM_ECR_REPO ?? "onenexium/user-apps",
  },
} as const;

/** AWS credentials present (SDK will use default chain: env, role, etc.) */
export function hasAwsCredentials(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_PROFILE ||
    process.env.AWS_ROLE_ARN
  );
}
