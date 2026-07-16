import { NextResponse } from "next/server";
import { getSessionOr401 } from "@/lib/api-guard";
import { canViewInfrastructure } from "@/lib/permissions";
import { getInfrastructureStatus } from "@/lib/aws-client";

export async function GET() {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  if (!canViewInfrastructure(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const status = await getInfrastructureStatus();
    return NextResponse.json(status);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Infrastructure status unavailable";
    return NextResponse.json({
      configured: false,
      error: message,
      ec2: null,
      rds: null,
      redis: null,
      alb: null,
      alarms: [],
      s3Bucket: "",
      ecrRepo: "",
      region: process.env.AWS_REGION ?? "ap-south-1",
    });
  }
}
