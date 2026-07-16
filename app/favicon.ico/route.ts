import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Serve favicon: redirect to the generated app icon so /favicon.ico does not 404.
 */
export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = process.env.NEXIUM_APP_URL || url.origin;
  return NextResponse.redirect(new URL("/icon", origin), 302);
}
