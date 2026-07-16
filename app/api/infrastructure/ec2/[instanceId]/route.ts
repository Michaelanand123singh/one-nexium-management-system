import { NextRequest, NextResponse } from "next/server";
import { getSessionOr401 } from "@/lib/api-guard";
import { canManageInfrastructure } from "@/lib/permissions";
import { setEC2InstanceState } from "@/lib/aws-client";

type Params = { params: Promise<{ instanceId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  if (!canManageInfrastructure(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { instanceId } = await params;
  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action === "start" || body.action === "stop" ? body.action : null;
  if (!action) {
    return NextResponse.json(
      { error: "Body must include { \"action\": \"start\" | \"stop\" }" },
      { status: 400 }
    );
  }

  try {
    const result = await setEC2InstanceState(instanceId, action);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
