import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAppBaseUrlFromEnv, resolveAppBaseUrl } from "@/lib/app-base-url";
import { canViewWorkstationTelemetry } from "@/lib/permissions";
import { WORKSTATION_INGEST_PATH } from "@/lib/workstation/constants";

/**
 * Domain-aware agent configuration for the Workstation module.
 * UI and docs use this so laptops target the correct cloud URL (via NEXIUM_APP_URL in prod).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewWorkstationTelemetry(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiBaseUrl = resolveAppBaseUrl(request.url);
  const ingestUrl = `${apiBaseUrl}${WORKSTATION_INGEST_PATH}`;

  return NextResponse.json({
    apiBaseUrl,
    ingestPath: WORKSTATION_INGEST_PATH,
    ingestUrl,
    /** True when `NEXIUM_APP_URL` or `NEXT_PUBLIC_APP_URL` fixed the origin (recommended in production). */
    originFromEnv: Boolean(getAppBaseUrlFromEnv()),
  });
}
